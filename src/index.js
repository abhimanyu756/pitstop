import api, { route } from "@forge/api";
import { isStalled, formatStallMessage } from "./telemetry.js";

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

    console.log(`Comment added to ${issueKey} (${issueId}) by ${authorId}`);

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

    // Fetch full issue details for stall detection
    console.log("Fetching full issue details...");
    const fullIssue = await getIssueDetails(issueId);

    if (!fullIssue) {
      console.error("Failed to fetch issue details");
      return;
    }

    // Run stall detection
    console.log("Running stall detection...");
    const stallInfo = await isStalled(fullIssue);

    console.log("Stall detection result:", JSON.stringify(stallInfo, null, 2));

    // If stalled, post a helpful comment
    if (stallInfo.isStalled) {
      const message = formatStallMessage(stallInfo, issueKey);

      if (message) {
        console.log("Issue is stalled - adding warning comment");
        await addComment(issueId, message);
        console.log("✅ Stall warning posted!");
      }
    } else {
      console.log("✅ Issue is healthy - no action needed");
      // Optionally post an encouraging message
      // await addComment(issueId, "👍 Keep up the good work!");
    }
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    console.error("Stack:", error.stack);
  }
}

// --- Helper Functions ---

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
