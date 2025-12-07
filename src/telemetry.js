/**
 * Enhanced Telemetry with Phase 2 Intelligence
 * Integrates changelog analysis and contextual suggestions
 */

import api, { route } from "@forge/api";
import { getThresholdForStatus, getSettings } from "./configManager.js";
import {
  analyzeChangelog,
  getRealLastActivity,
  formatChangelogInsights,
} from "./changelogAnalyzer.js";
import {
  generateContextualSuggestions,
  formatSuggestions,
} from "./contextAdvisor.js";

/**
 * Main function to check if an issue is stalled
 * NOW WITH PHASE 2 INTELLIGENCE! 🧠
 */
export const isStalled = async (issue) => {
  const stallReasons = [];
  const now = new Date();
  const settings = await getSettings();

  // Extract basic issue info
  const status = issue.fields.status.name;
  const assignee = issue.fields.assignee;
  const created = new Date(issue.fields.created);
  const updated = new Date(issue.fields.updated);
  const issueAge = (now - created) / (1000 * 60 * 60 * 24); // days

  console.log(`🔍 Analyzing ${issue.key} - Status: ${status}`);

  // 🆕 PHASE 2: Changelog Analysis
  let changelogAnalysis = null;
  if (settings.features.useChangelogAnalysis) {
    console.log("📊 Running changelog analysis...");
    changelogAnalysis = await analyzeChangelog(issue.id);
  }

  // 🆕 Use "real" last activity (ignoring bot noise)
  const lastActivity = changelogAnalysis
    ? getRealLastActivity(issue, changelogAnalysis)
    : updated;

  const timeSinceUpdate = (now - lastActivity) / (1000 * 60 * 60); // hours

  console.log(
    `Last meaningful activity: ${Math.floor(timeSinceUpdate)} hours ago`
  );

  // Check 1: Time since last update (using configurable threshold)
  if (settings.features.detectNoActivity) {
    const threshold = await getThresholdForStatus(status);
    if (timeSinceUpdate > threshold) {
      stallReasons.push({
        type: "NO_ACTIVITY",
        severity: timeSinceUpdate > threshold * 2 ? "HIGH" : "MEDIUM",
        message: `No activity in '${status}' for ${Math.floor(
          timeSinceUpdate
        )} hours (threshold: ${threshold}h)`,
        hours: Math.floor(timeSinceUpdate),
        threshold,
      });
    }
  }

  // Check 2: Time since last human comment
  if (settings.features.detectNoHumanComments) {
    try {
      const lastHumanComment = await getLastHumanComment(issue.id);
      if (lastHumanComment) {
        const timeSinceComment =
          (now - new Date(lastHumanComment.created)) / (1000 * 60 * 60);
        if (timeSinceComment > settings.noHumanCommentThreshold) {
          stallReasons.push({
            type: "NO_HUMAN_INTERACTION",
            severity: "MEDIUM",
            message: `No human comments for ${Math.floor(
              timeSinceComment
            )} hours (last by ${lastHumanComment.author})`,
            hours: Math.floor(timeSinceComment),
            lastAuthor: lastHumanComment.author,
          });
        }
      } else if (issueAge > 2) {
        stallReasons.push({
          type: "NO_COMMENTS",
          severity: "MEDIUM",
          message: `Issue is ${Math.floor(issueAge)} days old with no comments`,
          days: Math.floor(issueAge),
        });
      }
    } catch (error) {
      console.error("Error checking comments:", error.message);
    }
  }

  // Check 3: Assigned but not progressing
  if (assignee && status === "In Progress") {
    const threshold = await getThresholdForStatus("In Progress");
    if (timeSinceUpdate > threshold) {
      stallReasons.push({
        type: "ASSIGNED_NOT_PROGRESSING",
        severity: "HIGH",
        message: `Assigned to ${
          assignee.displayName
        } but no progress in ${Math.floor(timeSinceUpdate)} hours`,
        assignee: assignee.displayName,
        hours: Math.floor(timeSinceUpdate),
      });
    }
  }

  // Check 4: Unassigned in active status
  if (settings.features.detectUnassigned) {
    if (!assignee && (status === "In Progress" || status === "In Review")) {
      stallReasons.push({
        type: "UNASSIGNED_ACTIVE",
        severity: "HIGH",
        message: `Issue is '${status}' but has no assignee`,
        status: status,
      });
    }
  }

  // Check 5: Blocked or has blockers
  if (settings.features.detectBlockers) {
    try {
      const hasBlockers = await checkForBlockers(issue.id);
      if (hasBlockers.isBlocked) {
        stallReasons.push({
          type: "HAS_BLOCKERS",
          severity: "CRITICAL",
          message: `Blocked by ${
            hasBlockers.count
          } issue(s): ${hasBlockers.blockers.join(", ")}`,
          blockers: hasBlockers.blockers,
          count: hasBlockers.count,
        });
      }
    } catch (error) {
      console.error("Error checking blockers:", error.message);
    }
  }

  // Check 6: Status is explicitly "Blocked"
  if (status.toLowerCase() === "blocked") {
    stallReasons.push({
      type: "STATUS_BLOCKED",
      severity: "CRITICAL",
      message: `Issue status is 'Blocked' for ${Math.floor(
        timeSinceUpdate
      )} hours`,
      hours: Math.floor(timeSinceUpdate),
    });
  }

  // 🆕 PHASE 2: Add changelog pattern detections
  if (changelogAnalysis?.patterns && changelogAnalysis.patterns.length > 0) {
    changelogAnalysis.patterns.forEach((pattern) => {
      stallReasons.push({
        type: pattern.type,
        severity: pattern.severity,
        message: pattern.message,
        pattern: true,
        details: pattern,
      });
    });
  }

  // Compile results
  const isStalled = stallReasons.length > 0;
  const highestSeverity = getHighestSeverity(stallReasons);

  const result = {
    isStalled,
    severity: highestSeverity,
    reasons: stallReasons,
    summary: generateSummary(stallReasons),
    actionableInsights: [], // Will be populated below
    changelogAnalysis,
    contextualSuggestions: [],
  };

  // 🆕 PHASE 2: Generate contextual suggestions
  if (isStalled && settings.features.useContextualSuggestions) {
    console.log("💡 Generating contextual suggestions...");
    try {
      const suggestions = await generateContextualSuggestions(
        issue,
        result,
        changelogAnalysis
      );
      result.contextualSuggestions = suggestions;
    } catch (error) {
      console.error("Error generating suggestions:", error.message);
    }
  }

  // Legacy actionable insights (kept for backward compatibility)
  result.actionableInsights = generateActionableInsights(stallReasons, issue);

  console.log(
    `✅ Analysis complete: ${
      isStalled ? "STALLED" : "HEALTHY"
    } (${highestSeverity})`
  );

  return result;
};

/**
 * Get the last comment made by a human (not a bot)
 */
async function getLastHumanComment(issueId) {
  try {
    const response = await api
      .asApp()
      .requestJira(
        route`/rest/api/3/issue/${issueId}/comment?orderBy=-created&maxResults=50`
      );

    if (!response.ok) {
      console.error("Failed to fetch comments");
      return null;
    }

    const data = await response.json();
    const comments = data.comments || [];

    const humanComments = comments.filter((comment) => {
      const author = comment.author;
      return author && author.accountType === "atlassian" && author.active;
    });

    if (humanComments.length > 0) {
      return {
        created: humanComments[0].created,
        author: humanComments[0].author.displayName,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching comments:", error.message);
    return null;
  }
}

/**
 * Check if issue has blockers or is blocked by other issues
 */
async function checkForBlockers(issueId) {
  try {
    const response = await api
      .asApp()
      .requestJira(route`/rest/api/3/issue/${issueId}?fields=issuelinks`);

    if (!response.ok) {
      return { isBlocked: false, count: 0, blockers: [] };
    }

    const data = await response.json();
    const issueLinks = data.fields.issuelinks || [];

    const blockers = [];

    issueLinks.forEach((link) => {
      if (link.type.name === "Blocks" && link.inwardIssue) {
        blockers.push(link.inwardIssue.key);
      }
      if (link.type.inward === "is blocked by" && link.outwardIssue) {
        blockers.push(link.outwardIssue.key);
      }
    });

    return {
      isBlocked: blockers.length > 0,
      count: blockers.length,
      blockers: blockers,
    };
  } catch (error) {
    console.error("Error checking blockers:", error.message);
    return { isBlocked: false, count: 0, blockers: [] };
  }
}

/**
 * Determine the highest severity from reasons
 */
function getHighestSeverity(reasons) {
  const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  let highest = "LOW";

  reasons.forEach((reason) => {
    if (severityOrder[reason.severity] > severityOrder[highest]) {
      highest = reason.severity;
    }
  });

  return highest;
}

/**
 * Generate a human-readable summary
 */
function generateSummary(reasons) {
  if (reasons.length === 0) return "No stall detected";

  const criticalCount = reasons.filter((r) => r.severity === "CRITICAL").length;
  const highCount = reasons.filter((r) => r.severity === "HIGH").length;

  if (criticalCount > 0) {
    return `🚨 Critical: ${
      reasons.find((r) => r.severity === "CRITICAL").message
    }`;
  } else if (highCount > 0) {
    return `⚠️ High Priority: ${
      reasons.find((r) => r.severity === "HIGH").message
    }`;
  } else {
    return `⏰ Attention Needed: ${reasons[0].message}`;
  }
}

/**
 * Generate actionable insights (legacy - kept for compatibility)
 */
function generateActionableInsights(reasons, issue) {
  const insights = [];

  reasons.forEach((reason) => {
    switch (reason.type) {
      case "NO_ACTIVITY":
        insights.push(
          "💡 Consider updating the issue or moving it to a different status"
        );
        break;
      case "NO_HUMAN_INTERACTION":
        insights.push(
          `💡 Reach out to ${reason.lastAuthor || "the team"} for an update`
        );
        break;
      case "NO_COMMENTS":
        insights.push(
          "💡 Add a comment to start the conversation or clarify requirements"
        );
        break;
      case "ASSIGNED_NOT_PROGRESSING":
        insights.push(
          `💡 Check with ${reason.assignee} if they need help or if priorities have changed`
        );
        break;
      case "UNASSIGNED_ACTIVE":
        insights.push("💡 Assign this issue to someone to move it forward");
        break;
      case "HAS_BLOCKERS":
        insights.push(
          `💡 Resolve blockers first: ${reason.blockers.join(", ")}`
        );
        break;
      case "STATUS_BLOCKED":
        insights.push(
          "💡 Identify and document what is blocking this issue, then work to resolve it"
        );
        break;
    }
  });

  return [...new Set(insights)];
}

/**
 * Format stall information for display in a comment
 * 🆕 NOW WITH PHASE 2 ENHANCEMENTS!
 */
export function formatStallMessage(stallInfo, issueKey) {
  if (!stallInfo.isStalled) {
    return null;
  }

  let message = `🏎️ **Pit Stop Alert** - ${issueKey}\n\n`;
  message += `${stallInfo.summary}\n\n`;

  // Add main stall reasons
  if (stallInfo.reasons.length > 1) {
    message += `**Issues Detected:**\n`;
    stallInfo.reasons.forEach((reason) => {
      const emoji =
        reason.severity === "CRITICAL"
          ? "🚨"
          : reason.severity === "HIGH"
          ? "⚠️"
          : "⏰";
      message += `${emoji} ${reason.message}\n`;
    });
    message += "\n";
  }

  // 🆕 Add changelog insights if available
  if (stallInfo.changelogAnalysis) {
    const insights = formatChangelogInsights(stallInfo.changelogAnalysis);
    if (insights) {
      message += insights + "\n";
    }
  }

  // 🆕 Use contextual suggestions if available (Phase 2)
  if (
    stallInfo.contextualSuggestions &&
    stallInfo.contextualSuggestions.length > 0
  ) {
    message += formatSuggestions(stallInfo.contextualSuggestions);
  } else if (stallInfo.actionableInsights.length > 0) {
    // Fall back to legacy insights
    message += `**Suggested Actions:**\n`;
    stallInfo.actionableInsights.forEach((insight) => {
      message += `${insight}\n`;
    });
  }

  return message;
}
