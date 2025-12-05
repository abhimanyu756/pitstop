import api, { route } from "@forge/api";

let appAccountId = null;

export async function handleComment(event, context) {
  console.log("=== COMMENT HANDLER TRIGGERED ===");
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // For Jira comment triggers, the event structure is different
    // The event object contains the comment data directly
    const comment = event.comment;
    const issue = event.issue;

    if (!comment || !issue) {
      console.error("Missing comment or issue in event");
      console.error("Event keys:", Object.keys(event));
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

    // Add the reply
    console.log("Adding reply comment...");
    await addComment(issueId, "Hello World 🌍 (I am alive!)");
    console.log("✅ Reply added successfully!");
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
