import api, { route } from "@forge/api";
import { isStalled, formatStallMessage } from "./telemetry.js";
import { ACTIVE_STATUSES, MAX_ISSUES_PER_RUN } from "./config.js";

/**
 * Main scheduled function to scan for stalled issues
 */
export async function scanForStalledIssues(event, context) {
  console.log("=== SCHEDULED STALL SCANNER STARTED ===");
  console.log("Timestamp:", new Date().toISOString());

  try {
    const stalledIssues = [];
    const scannedIssues = [];
    const errors = [];

    // Fetch issues in active statuses
    console.log("Fetching issues in active statuses...");
    const issues = await fetchActiveIssues();

    console.log(`Found ${issues.length} issues to scan`);

    // Process each issue
    for (const issue of issues) {
      try {
        console.log(`Scanning ${issue.key}...`);
        scannedIssues.push(issue.key);

        // Fetch full issue details
        const fullIssue = await getIssueDetails(issue.id);

        if (!fullIssue) {
          console.error(`Failed to fetch details for ${issue.key}`);
          errors.push({ issue: issue.key, error: "Failed to fetch details" });
          continue;
        }

        // Run stall detection
        const stallInfo = await isStalled(fullIssue);

        if (stallInfo.isStalled) {
          console.log(`⚠️ ${issue.key} is STALLED (${stallInfo.severity})`);
          stalledIssues.push({
            key: issue.key,
            severity: stallInfo.severity,
            reasons: stallInfo.reasons,
          });

          // Check if we already commented recently
          const shouldComment = await shouldPostComment(issue.id, issue.key);

          if (shouldComment) {
            // Post stall warning
            const message = formatStallMessage(stallInfo, issue.key);
            await addComment(issue.id, message);
            console.log(`✅ Posted stall warning to ${issue.key}`);
          } else {
            console.log(
              `⏭️ Skipping ${issue.key} - already commented recently`
            );
          }
        } else {
          console.log(`✅ ${issue.key} is healthy`);
        }

        // Small delay to avoid rate limiting
        await sleep(100);
      } catch (error) {
        console.error(`Error processing ${issue.key}:`, error.message);
        errors.push({ issue: issue.key, error: error.message });
      }
    }

    // Summary
    console.log("\n=== SCAN COMPLETE ===");
    console.log(`Scanned: ${scannedIssues.length} issues`);
    console.log(`Stalled: ${stalledIssues.length} issues`);
    console.log(`Errors: ${errors.length}`);

    if (stalledIssues.length > 0) {
      console.log("\nStalled Issues:");
      stalledIssues.forEach((item) => {
        console.log(`  - ${item.key} (${item.severity})`);
      });
    }

    if (errors.length > 0) {
      console.log("\nErrors:");
      errors.forEach((err) => {
        console.log(`  - ${err.issue}: ${err.error}`);
      });
    }

    console.log("=== SCANNER FINISHED ===\n");

    return {
      success: true,
      scanned: scannedIssues.length,
      stalled: stalledIssues.length,
      errors: errors.length,
    };
  } catch (error) {
    console.error("❌ SCANNER ERROR:", error.message);
    console.error("Stack:", error.stack);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Fetch all issues in active statuses using POST method
 */
async function fetchActiveIssues() {
  try {
    // Build JQL query for active statuses
    const statusFilter = ACTIVE_STATUSES.map((s) => `"${s}"`).join(",");
    const jql = `status in (${statusFilter}) ORDER BY updated ASC`;

    console.log("JQL Query:", jql);
    console.log("Using POST method for search...");

    // Use the NEW /search/jql endpoint (not /search)
    const response = await api
      .asApp()
      .requestJira(route`/rest/api/3/search/jql`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jql: jql,
          maxResults: MAX_ISSUES_PER_RUN,
          fields: ["id", "key", "status", "assignee", "updated", "created"],
        }),
      });

    if (!response.ok) {
      console.error("Failed to fetch issues:", response.status);
      const errorText = await response.text();
      console.error("Error details:", errorText);
      return [];
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched ${data.issues?.length || 0} issues`);
    return data.issues || [];
  } catch (error) {
    console.error("Error fetching issues:", error.message);
    console.error("Stack:", error.stack);
    return [];
  }
}

/**
 * Get full issue details
 */
async function getIssueDetails(issueId) {
  try {
    const response = await api
      .asApp()
      .requestJira(
        route`/rest/api/3/issue/${issueId}?fields=status,assignee,created,updated,comment,issuelinks,summary,description,priority`
      );

    if (!response.ok) {
      console.error("Failed to fetch issue details");
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching issue:", error.message);
    return null;
  }
}

/**
 * Check if we should post a comment (avoid spamming)
 * Only comment if we haven't commented in the last 24 hours
 */
async function shouldPostComment(issueId, issueKey) {
  try {
    // Get app account ID
    const appAccountId = await getAppAccountId();

    if (!appAccountId) {
      return true; // If we can't check, proceed anyway
    }

    // Fetch recent comments
    const response = await api
      .asApp()
      .requestJira(
        route`/rest/api/3/issue/${issueId}/comment?orderBy=-created&maxResults=10`
      );

    if (!response.ok) {
      return true; // If we can't check, proceed anyway
    }

    const data = await response.json();
    const comments = data.comments || [];

    // Check if we commented recently (within last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentBotComments = comments.filter((comment) => {
      const isBot = comment.author?.accountId === appAccountId;
      const isRecent = new Date(comment.created) > twentyFourHoursAgo;
      const isPitStopComment = comment.body?.content?.some((c) =>
        c.content?.some((t) => t.text?.includes("Pit Stop Alert"))
      );
      return isBot && isRecent && isPitStopComment;
    });

    if (recentBotComments.length > 0) {
      console.log(`Already commented on ${issueKey} recently`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error checking comments:", error.message);
    return true; // If error, proceed with commenting
  }
}

/**
 * Get app's account ID
 */
async function getAppAccountId() {
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/myself`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.accountId;
  } catch (error) {
    console.error("Error getting app account:", error.message);
    return null;
  }
}

/**
 * Add a comment to an issue
 */
async function addComment(issueId, text) {
  const commentBody = {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: text,
            },
          ],
        },
      ],
    },
  };

  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${issueId}/comment`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commentBody),
    });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add comment: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
