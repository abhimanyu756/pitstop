import api, { route } from "@forge/api";

// Configurable thresholds (hours)
const STALL_THRESHOLDS = {
  "In Progress": 48, // 2 days
  "In Review": 24, // 1 day
  "Code Review": 24, // 1 day
  "To Do": 168, // 1 week
  Backlog: 336, // 2 weeks
  Blocked: 12, // 12 hours (should be resolved quickly)
  default: 72, // 3 days for any other status
};

// Time without human comment threshold
const NO_HUMAN_COMMENT_THRESHOLD = 96; // 4 days

/**
 * Main function to check if an issue is stalled
 * Returns detailed stall information
 */
export const isStalled = async (issue) => {
  const stallReasons = [];
  const now = new Date();

  // Extract basic issue info
  const status = issue.fields.status.name;
  const updated = new Date(issue.fields.updated);
  const created = new Date(issue.fields.created);
  const assignee = issue.fields.assignee;
  const timeSinceUpdate = (now - updated) / (1000 * 60 * 60); // hours
  const issueAge = (now - created) / (1000 * 60 * 60 * 24); // days

  // Check 1: Time since last update
  const threshold = STALL_THRESHOLDS[status] || STALL_THRESHOLDS["default"];
  if (timeSinceUpdate > threshold) {
    stallReasons.push({
      type: "NO_ACTIVITY",
      severity: "HIGH",
      message: `No activity in '${status}' for ${Math.floor(
        timeSinceUpdate
      )} hours (threshold: ${threshold}h)`,
      hours: Math.floor(timeSinceUpdate),
    });
  }

  // Check 2: Time since last human comment
  try {
    const lastHumanComment = await getLastHumanComment(issue.id);
    if (lastHumanComment) {
      const timeSinceComment =
        (now - new Date(lastHumanComment.created)) / (1000 * 60 * 60);
      if (timeSinceComment > NO_HUMAN_COMMENT_THRESHOLD) {
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
    } else {
      // No comments at all
      if (issueAge > 2) {
        // More than 2 days old with no comments
        stallReasons.push({
          type: "NO_COMMENTS",
          severity: "MEDIUM",
          message: `Issue is ${Math.floor(issueAge)} days old with no comments`,
          days: Math.floor(issueAge),
        });
      }
    }
  } catch (error) {
    console.error("Error checking comments:", error.message);
  }

  // Check 3: Assigned but not progressing
  if (assignee && status === "In Progress") {
    // If it's been "In Progress" for a long time, it might be stuck
    if (timeSinceUpdate > STALL_THRESHOLDS["In Progress"]) {
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
  if (!assignee && (status === "In Progress" || status === "In Review")) {
    stallReasons.push({
      type: "UNASSIGNED_ACTIVE",
      severity: "HIGH",
      message: `Issue is '${status}' but has no assignee`,
      status: status,
    });
  }

  // Check 5: Blocked or has blockers
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

  // Compile results
  const isStalled = stallReasons.length > 0;
  const highestSeverity = getHighestSeverity(stallReasons);

  return {
    isStalled,
    severity: highestSeverity,
    reasons: stallReasons,
    summary: generateSummary(stallReasons),
    actionableInsights: generateActionableInsights(stallReasons, issue),
  };
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

    // Filter out bot comments (bots usually have accountType: 'app' or 'atlassian')
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
      // Check if this issue is blocked by another
      if (link.type.name === "Blocks" && link.inwardIssue) {
        blockers.push(link.inwardIssue.key);
      }
      // Or if there's a "is blocked by" relationship
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
    return `🚨 Critical: ${reasons[0].message}`;
  } else if (highCount > 0) {
    return `⚠️ High Priority: ${reasons[0].message}`;
  } else {
    return `⏰ Attention Needed: ${reasons[0].message}`;
  }
}

/**
 * Generate actionable insights based on stall reasons
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

  // Remove duplicates
  return [...new Set(insights)];
}

/**
 * Format stall information for display in a comment
 */
export function formatStallMessage(stallInfo, issueKey) {
  if (!stallInfo.isStalled) {
    return null;
  }

  let message = `🏎️ **Pit Stop Alert** - ${issueKey}\n\n`;
  message += `${stallInfo.summary}\n\n`;

  if (stallInfo.reasons.length > 1) {
    message += `**Issues Detected:**\n`;
    stallInfo.reasons.forEach((reason, index) => {
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

  if (stallInfo.actionableInsights.length > 0) {
    message += `**Suggested Actions:**\n`;
    stallInfo.actionableInsights.forEach((insight) => {
      message += `${insight}\n`;
    });
  }

  return message;
}
