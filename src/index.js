import api, { route } from "@forge/api";
import { isStalled, formatStallMessage } from "./telemetry.js";
import { COMMENT_COOLDOWN_HOURS } from "./config.js";

let appAccountId = null;

// 🧪 TEST FUNCTION: Call this with any issue key to test stall detection
export async function testStallDetection(issueKey) {
  console.log(`=== TESTING STALL DETECTION FOR ${issueKey} ===`);

  try {
    // Search for the issue by key
    const searchResponse = await api
      .asApp()
      .requestJira(route`/rest/api/3/search?jql=key=${issueKey}`);

    const searchData = await searchResponse.json();

    if (!searchData.issues || searchData.issues.length === 0) {
      console.error(`Issue ${issueKey} not found`);
      return;
    }

    const issue = searchData.issues[0];
    const issueId = issue.id;

    // Fetch full details
    const fullIssue = await getIssueDetails(issueId);

    if (!fullIssue) {
      console.error("Failed to fetch issue details");
      return;
    }

    // Run stall detection
    console.log("Running stall detection...");
    const stallInfo = await isStalled(fullIssue);

    console.log("=== STALL DETECTION RESULT ===");
    console.log(JSON.stringify(stallInfo, null, 2));

    // Post comment if stalled
    if (stallInfo.isStalled) {
      const message = formatStallMessage(stallInfo, issueKey);
      await addComment(issueId, message);
      console.log("✅ Test comment posted!");
    } else {
      console.log("✅ Issue is healthy!");
    }

    return stallInfo;
  } catch (error) {
    console.error("Test error:", error.message);
    console.error(error.stack);
  }
}

// Export scanner function for scheduled trigger
export { scanForStalledIssues } from "./scanner.js";

/**
 * 🎯 FEATURE 1.3: Smart Comment Responses
 * Handles comments on issues and responds with helpful nudges if stalled
 */
export async function handleComment(event, context) {
  console.log("=== COMMENT HANDLER TRIGGERED ===");
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const comment = event.comment;
    const issue = event.issue;

    if (!comment || !issue) {
      console.error("Missing comment or issue in event");
      return;
    }

    const issueId = issue.id;
    const issueKey = issue.key;
    const authorId = comment.author?.accountId;
    const authorName = comment.author?.displayName || "User";

    console.log(
      `Comment added to ${issueKey} (${issueId}) by ${authorName} (${authorId})`
    );

    // Get app's account ID to prevent infinite loop
    if (!appAccountId) {
      appAccountId = await getAppAccountId();
      console.log("App account ID:", appAccountId);
    }

    // Don't reply to our own comments
    if (authorId === appAccountId) {
      console.log("Skipping - this is our own comment");
      return;
    }

    // Check if we recently commented on this issue (avoid spam)
    const recentlyCommented = await hasRecentBotComment(issueId, issueKey);
    if (recentlyCommented) {
      console.log(`⏭️ Skipping ${issueKey} - already commented recently`);
      return;
    }

    // Fetch full issue details for stall detection
    console.log("Fetching full issue details...");
    const fullIssue = await getIssueDetails(issueId);

    if (!fullIssue) {
      console.error("Failed to fetch issue details");
      return;
    }

    const status = fullIssue.fields.status.name;
    const assignee = fullIssue.fields.assignee;

    // Run stall detection
    console.log("Running stall detection...");
    const stallInfo = await isStalled(fullIssue);

    console.log("Stall detection result:", JSON.stringify(stallInfo, null, 2));

    // 🎯 Smart Response Logic
    if (stallInfo.isStalled) {
      // Issue is stalled - post helpful nudge
      console.log(
        `⚠️ Issue is stalled (${stallInfo.severity}) - posting nudge`
      );

      const message = formatSmartResponse(stallInfo, issueKey, {
        authorName,
        status,
        assignee: assignee?.displayName,
      });

      await addComment(issueId, message);
      console.log("✅ Stall warning posted!");
    } else {
      // Issue is healthy - optional encouragement
      console.log("✅ Issue is healthy");

      // Only post encouragement if:
      // 1. Issue was recently updated (within 24 hours)
      // 2. User is the assignee or made significant progress
      const shouldEncourage = await shouldPostEncouragement(
        fullIssue,
        authorId
      );

      if (shouldEncourage) {
        const encouragement = getEncouragementMessage(status, authorName);
        await addComment(issueId, encouragement);
        console.log("✅ Posted encouragement!");
      } else {
        console.log("ℹ️ Staying silent - no action needed");
      }
    }
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    console.error("Stack:", error.stack);
  }
}

// --- Helper Functions ---

/**
 * Format a smart, contextual response based on stall info
 */
function formatSmartResponse(stallInfo, issueKey, context) {
  const { authorName, status, assignee } = context;

  let message = `🏎️ **Pit Stop Alert** - Thanks for the update, ${authorName}!\n\n`;

  // Context-aware opening based on severity
  if (stallInfo.severity === "CRITICAL") {
    message += `🚨 This issue needs immediate attention:\n\n`;
  } else if (stallInfo.severity === "HIGH") {
    message += `⚠️ I noticed this issue might be stalled:\n\n`;
  } else {
    message += `⏰ Just a friendly heads-up:\n\n`;
  }

  // Add specific stall reasons with context
  stallInfo.reasons.forEach((reason, index) => {
    const emoji =
      reason.severity === "CRITICAL"
        ? "🚨"
        : reason.severity === "HIGH"
        ? "⚠️"
        : "⏰";

    // Make messages more conversational
    let contextualMessage = reason.message;

    if (reason.type === "NO_ACTIVITY") {
      contextualMessage = `This issue has been in '${status}' for ${reason.hours} hours without updates`;
    } else if (reason.type === "HAS_BLOCKERS") {
      contextualMessage = `⛔ Blocked by: ${reason.blockers.join(
        ", "
      )} - these need to be resolved first`;
    } else if (reason.type === "ASSIGNED_NOT_PROGRESSING" && assignee) {
      contextualMessage = `No progress since assigned to ${assignee}. Need any help?`;
    }

    message += `${emoji} ${contextualMessage}\n`;
  });

  message += `\n`;

  // Add actionable insights
  if (stallInfo.actionableInsights.length > 0) {
    message += `**What you can do:**\n`;
    stallInfo.actionableInsights.forEach((insight) => {
      message += `${insight}\n`;
    });
  }

  message += `\n_💡 Tip: Update the status or add a comment to keep things moving!_`;

  return message;
}

/**
 * Get an encouraging message for healthy issues
 */
function getEncouragementMessage(status, authorName) {
  const encouragements = {
    "In Progress": [
      `✅ Great progress, ${authorName}! Keep up the momentum! 🚀`,
      `👏 Nice work on this! The team appreciates the updates.`,
      `🎯 On track! Thanks for keeping this moving forward.`,
    ],
    "In Review": [
      `👀 Thanks for getting this into review! Reviewers have been notified.`,
      `✅ Code review in progress! Great job getting this ready.`,
      `🔍 In review - appreciate you moving this along!`,
    ],
    "Code Review": [
      `👀 Thanks for getting this into review! Reviewers have been notified.`,
      `✅ Under review! Great work getting this to this stage.`,
    ],
    Testing: [
      `🧪 In testing - great progress! Almost there!`,
      `✅ Nice! QA will verify this soon.`,
    ],
    Done: [
      `🎉 Awesome work! This is complete!`,
      `✅ Shipped! Great job seeing this through.`,
    ],
    default: [
      `👍 Keep up the good work, ${authorName}!`,
      `✅ Thanks for the update!`,
      `🚀 Nice progress!`,
    ],
  };

  const messages = encouragements[status] || encouragements["default"];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Determine if we should post encouragement
 * Only encourage when:
 * - Issue is actively being worked on
 * - User is the assignee
 * - Recent significant activity
 */
async function shouldPostEncouragement(issue, authorId) {
  const status = issue.fields.status.name;
  const assignee = issue.fields.assignee;
  const updated = new Date(issue.fields.updated);
  const now = new Date();
  const hoursSinceUpdate = (now - updated) / (1000 * 60 * 60);

  // Only encourage if:
  // 1. Status is active (not backlog or done)
  const activeStatuses = ["In Progress", "In Review", "Code Review", "Testing"];
  if (!activeStatuses.includes(status)) {
    return false;
  }

  // 2. User is the assignee (they're responsible for this)
  if (assignee && assignee.accountId === authorId) {
    return true;
  }

  // 3. OR recent significant activity (within 2 hours)
  if (hoursSinceUpdate < 2) {
    return true;
  }

  return false;
}

/**
 * Check if bot commented recently (within cooldown period)
 */
async function hasRecentBotComment(issueId, issueKey) {
  try {
    const appId = await getAppAccountId();
    if (!appId) return false;

    const response = await api
      .asApp()
      .requestJira(
        route`/rest/api/3/issue/${issueId}/comment?orderBy=-created&maxResults=10`
      );

    if (!response.ok) return false;

    const data = await response.json();
    const comments = data.comments || [];

    const cooldownMs = COMMENT_COOLDOWN_HOURS * 60 * 60 * 1000;
    const cooldownTime = new Date(Date.now() - cooldownMs);

    const recentBotComments = comments.filter((comment) => {
      const isBot = comment.author?.accountId === appId;
      const isRecent = new Date(comment.created) > cooldownTime;
      const isPitStopComment = comment.body?.content?.some((c) =>
        c.content?.some((t) => t.text?.includes("Pit Stop Alert"))
      );
      return isBot && isRecent && isPitStopComment;
    });

    if (recentBotComments.length > 0) {
      console.log(`Already commented on ${issueKey} recently`);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking recent comments:", error.message);
    return false;
  }
}

async function getAppAccountId() {
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/myself`);

    if (!response.ok) {
      console.error("Failed to get app account");
      return null;
    }

    const data = await response.json();
    return data.accountId;
  } catch (error) {
    console.error("Error getting app account:", error.message);
    return null;
  }
}

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

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching issue:", error.message);
    return null;
  }
}

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
