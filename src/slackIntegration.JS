/**
 * Feature 3.3: Slack/Teams Integration
 * Send notifications to external team channels
 */

import api, { route } from "@forge/api";

/**
 * Send a message to Slack webhook
 */
export async function sendSlackMessage(webhookUrl, message) {
  try {
    if (!webhookUrl) {
      console.log("No Slack webhook configured");
      return { success: false, error: "No webhook URL" };
    }

    const response = await api.fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Slack webhook error:", errorText);
      return { success: false, error: errorText };
    }

    console.log("✅ Slack message sent successfully");
    return { success: true };
  } catch (error) {
    console.error("Error sending Slack message:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send a message to Teams webhook
 */
export async function sendTeamsMessage(webhookUrl, message) {
  try {
    if (!webhookUrl) {
      console.log("No Teams webhook configured");
      return { success: false, error: "No webhook URL" };
    }

    const response = await api.fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Teams webhook error:", errorText);
      return { success: false, error: errorText };
    }

    console.log("✅ Teams message sent successfully");
    return { success: true };
  } catch (error) {
    console.error("Error sending Teams message:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Format stalled issues for Slack message
 */
export function formatSlackDigest(stalledIssues, jiraBaseUrl) {
  const totalStalled = stalledIssues.length;

  if (totalStalled === 0) {
    return {
      text: "✅ Great news! No stalled issues today.",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🏎️ Pit Stop Daily Digest",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "✅ *All issues are healthy!* Great work, team! 🎉",
          },
        },
      ],
    };
  }

  // Group by severity
  const critical = stalledIssues.filter((i) => i.severity === "CRITICAL");
  const high = stalledIssues.filter((i) => i.severity === "HIGH");
  const medium = stalledIssues.filter((i) => i.severity === "MEDIUM");
  const low = stalledIssues.filter((i) => i.severity === "LOW");

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🏎️ Pit Stop Daily Digest",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *${totalStalled} issue${totalStalled > 1 ? "s" : ""} need${
          totalStalled === 1 ? "s" : ""
        } attention today*`,
      },
    },
    {
      type: "divider",
    },
  ];

  // Add critical issues
  if (critical.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🚨 *Critical (${critical.length})*`,
      },
    });

    critical.slice(0, 5).forEach((issue) => {
      const issueUrl = `${jiraBaseUrl}/browse/${issue.key}`;
      const reasons = issue.reasons
        .map((r) => r.type.replace(/_/g, " "))
        .join(", ");
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `• <${issueUrl}|${issue.key}>: ${
            issue.status
          }\n  _${reasons}_\n  Assignee: ${issue.assignee || "Unassigned"}`,
        },
      });
    });

    if (critical.length > 5) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_... and ${critical.length - 5} more critical issues_`,
          },
        ],
      });
    }
  }

  // Add high priority issues
  if (high.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *High Priority (${high.length})*`,
      },
    });

    high.slice(0, 5).forEach((issue) => {
      const issueUrl = `${jiraBaseUrl}/browse/${issue.key}`;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `• <${issueUrl}|${issue.key}>: ${issue.status} - ${
            issue.assignee || "Unassigned"
          }`,
        },
      });
    });

    if (high.length > 5) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_... and ${high.length - 5} more high priority issues_`,
          },
        ],
      });
    }
  }

  // Summary for medium/low
  if (medium.length > 0 || low.length > 0) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📊 Also: ${medium.length} medium, ${low.length} low priority`,
        },
      ],
    });
  }

  return {
    text: `⚠️ ${totalStalled} stalled issues need attention`,
    blocks,
  };
}

/**
 * Format stalled issues for Teams message (Adaptive Card)
 */
export function formatTeamsDigest(stalledIssues, jiraBaseUrl) {
  const totalStalled = stalledIssues.length;

  if (totalStalled === 0) {
    return {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: "Pit Stop Daily Digest",
      themeColor: "28a745",
      title: "🏎️ Pit Stop Daily Digest",
      sections: [
        {
          activityTitle: "✅ All issues are healthy!",
          activitySubtitle: "Great work, team! 🎉",
          activityImage: null,
        },
      ],
    };
  }

  const critical = stalledIssues.filter((i) => i.severity === "CRITICAL");
  const high = stalledIssues.filter((i) => i.severity === "HIGH");
  const medium = stalledIssues.filter((i) => i.severity === "MEDIUM");
  const low = stalledIssues.filter((i) => i.severity === "LOW");

  const sections = [];

  // Summary section
  sections.push({
    activityTitle: `⚠️ ${totalStalled} issue${
      totalStalled > 1 ? "s" : ""
    } need${totalStalled === 1 ? "s" : ""} attention`,
    activitySubtitle: `🚨 ${critical.length} Critical | ⚠️ ${high.length} High | 📊 ${medium.length} Medium | ℹ️ ${low.length} Low`,
  });

  // Critical issues
  if (critical.length > 0) {
    const facts = [];
    critical.slice(0, 5).forEach((issue) => {
      facts.push({
        name: `🚨 ${issue.key}`,
        value: `${issue.status} - ${issue.assignee || "Unassigned"}`,
      });
    });

    sections.push({
      title: "Critical Issues",
      facts: facts,
    });
  }

  // High priority issues
  if (high.length > 0) {
    const facts = [];
    high.slice(0, 5).forEach((issue) => {
      facts.push({
        name: `⚠️ ${issue.key}`,
        value: `${issue.status} - ${issue.assignee || "Unassigned"}`,
      });
    });

    sections.push({
      title: "High Priority Issues",
      facts: facts,
    });
  }

  // Add action button
  const potentialActions = [
    {
      "@type": "OpenUri",
      name: "View in Jira",
      targets: [
        {
          os: "default",
          uri: `${jiraBaseUrl}/issues/?jql=labels=stalled-critical OR labels=stalled-high`,
        },
      ],
    },
  ];

  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: `${totalStalled} stalled issues`,
    themeColor:
      critical.length > 0 ? "d73a4a" : high.length > 0 ? "fb8c00" : "0366d6",
    title: "🏎️ Pit Stop Daily Digest",
    sections: sections,
    potentialAction: potentialActions,
  };
}

/**
 * Send instant notification for critical issue
 */
export async function sendCriticalAlert(issue, stallInfo, settings) {
  if (!settings.integrations?.enabled) {
    return { success: false, message: "Integrations not enabled" };
  }

  const jiraBaseUrl =
    settings.integrations.jiraBaseUrl || "https://your-domain.atlassian.net";
  const issueUrl = `${jiraBaseUrl}/browse/${issue.key}`;

  // Slack alert
  if (settings.integrations.slackWebhook) {
    const slackMessage = {
      text: `🚨 CRITICAL: ${issue.key} is severely stalled`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🚨 Critical Stall Alert",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*<${issueUrl}|${issue.key}>* requires immediate attention!`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Status:*\n${issue.fields.status.name}`,
            },
            {
              type: "mrkdwn",
              text: `*Assignee:*\n${
                issue.fields.assignee?.displayName || "Unassigned"
              }`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Issues:*\n${stallInfo.reasons
              .map((r) => `• ${r.message}`)
              .join("\n")}`,
          },
        },
      ],
    };

    await sendSlackMessage(settings.integrations.slackWebhook, slackMessage);
  }

  // Teams alert
  if (settings.integrations.teamsWebhook) {
    const teamsMessage = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: `Critical: ${issue.key}`,
      themeColor: "d73a4a",
      title: "🚨 Critical Stall Alert",
      sections: [
        {
          activityTitle: issue.key,
          activitySubtitle: stallInfo.summary,
          facts: [
            { name: "Status", value: issue.fields.status.name },
            {
              name: "Assignee",
              value: issue.fields.assignee?.displayName || "Unassigned",
            },
            {
              name: "Issues",
              value: stallInfo.reasons.map((r) => r.message).join("; "),
            },
          ],
        },
      ],
      potentialAction: [
        {
          "@type": "OpenUri",
          name: "View Issue",
          targets: [{ os: "default", uri: issueUrl }],
        },
      ],
    };

    await sendTeamsMessage(settings.integrations.teamsWebhook, teamsMessage);
  }

  return { success: true, message: "Critical alert sent" };
}

/**
 * Send daily digest of all stalled issues
 */
export async function sendDailyDigest(stalledIssuesSummary, settings) {
  if (!settings.integrations?.enabled) {
    console.log("Integrations not enabled");
    return { success: false, message: "Integrations not enabled" };
  }

  const jiraBaseUrl =
    settings.integrations.jiraBaseUrl || "https://your-domain.atlassian.net";
  const results = [];

  // Send to Slack
  if (
    settings.integrations.slackWebhook &&
    settings.integrations.sendDailyDigest
  ) {
    console.log("📤 Sending daily digest to Slack...");
    const slackMessage = formatSlackDigest(stalledIssuesSummary, jiraBaseUrl);
    const result = await sendSlackMessage(
      settings.integrations.slackWebhook,
      slackMessage
    );
    results.push({ platform: "Slack", ...result });
  }

  // Send to Teams
  if (
    settings.integrations.teamsWebhook &&
    settings.integrations.sendDailyDigest
  ) {
    console.log("📤 Sending daily digest to Teams...");
    const teamsMessage = formatTeamsDigest(stalledIssuesSummary, jiraBaseUrl);
    const result = await sendTeamsMessage(
      settings.integrations.teamsWebhook,
      teamsMessage
    );
    results.push({ platform: "Teams", ...result });
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(
    `✅ Daily digest sent to ${successCount}/${results.length} platforms`
  );

  return {
    success: successCount > 0,
    results,
    message: `Sent to ${successCount}/${results.length} platforms`,
  };
}

/**
 * Test webhook connectivity
 */
export async function testWebhook(webhookUrl, platform) {
  const testMessage =
    platform === "slack"
      ? {
          text: "✅ Pit Stop webhook test successful!",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "🏎️ *Pit Stop* webhook is configured correctly!\n\nYou'll receive stall notifications here.",
              },
            },
          ],
        }
      : {
          "@type": "MessageCard",
          "@context": "https://schema.org/extensions",
          summary: "Webhook Test",
          themeColor: "28a745",
          title: "✅ Pit Stop Webhook Test",
          sections: [
            {
              activityTitle: "Success!",
              activitySubtitle:
                "Webhook is configured correctly. You'll receive stall notifications here.",
            },
          ],
        };

  if (platform === "slack") {
    return await sendSlackMessage(webhookUrl, testMessage);
  } else {
    return await sendTeamsMessage(webhookUrl, testMessage);
  }
}
