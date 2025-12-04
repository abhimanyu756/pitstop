import api, { route } from '@forge/api';
import { isStalled } from './telemetry';

export const run = async (req) => {
    console.log("Pit Stop App Running");
};

export const handleComment = async (event) => {
    const { issue, comment } = event;

    console.log("DEBUG: Event received!");
    console.log(`User: ${comment.author.displayName} wrote a comment.`);

    // Prevent infinite loops: Don't reply to the app's own comments
    // (In a real app, check accountId. For now, assume if it says "Hello World" it's us)
    const text = extractTextFromComment(comment.body);
    if (text.includes("Hello World")) return;

    await addComment(issue.id, "Hello World 🌍 (I am alive!)");
};

export const checkStall = async (event) => {
    // Passive monitoring (Scheduled or Event-based)
    const issueId = event.issue.id;
    const issue = await getIssueDetails(issueId);

    const stallData = await isStalled(issue);

    if (stallData.isStalled) {
        console.log(`Issue ${issue.key} is stalled: ${stallData.reason}`);
        // Optional: Auto-comment on severe stalls even without !pitstop trigger
    }
};

// --- Helpers ---

async function getIssueDetails(issueId) {
    const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}?expand=changelog`);
    return await response.json();
}

async function addComment(issueId, body) {
    // Jira Cloud ADF format
    const requestBody = {
        body: {
            type: "doc",
            version: 1,
            content: [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "text",
                            text: body
                        }
                    ]
                }
            ]
        }
    };

    await api.asApp().requestJira(route`/rest/api/3/issue/${issueId}/comment`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
}

function extractTextFromComment(body) {
    // Simple helper to get text from ADF
    try {
        return body.content.map(p => p.content.map(t => t.text).join(' ')).join(' ');
    } catch (e) {
        return "";
    }
}
