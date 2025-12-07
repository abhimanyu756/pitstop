/**
 * Feature 2.2: Context-Aware Suggestions
 * Provides specific, actionable advice based on issue context
 */

import api, { route } from "@forge/api";

/**
 * Generate context-aware suggestions based on issue state and stall reasons
 */
export async function generateContextualSuggestions(
  issue,
  stallInfo,
  changelogAnalysis
) {
  const suggestions = [];
  const status = issue.fields.status.name;
  const assignee = issue.fields.assignee;
  const reporter = issue.fields.reporter;
  const priority = issue.fields.priority?.name;
  const issueKey = issue.key;

  console.log(`🧠 Generating contextual suggestions for ${issueKey}`);

  // Fetch additional context
  const [blockers, watchers, linkedIssues] = await Promise.all([
    getBlockingIssues(issue.id),
    getWatchers(issue.id),
    getLinkedIssues(issue.id),
  ]);

  // Process each stall reason for specific suggestions
  for (const reason of stallInfo.reasons) {
    switch (reason.type) {
      case "UNASSIGNED_ACTIVE":
        suggestions.push(
          ...(await getUnassignedSuggestions(issue, watchers, reporter))
        );
        break;

      case "NO_ACTIVITY":
        suggestions.push(
          ...(await getNoActivitySuggestions(issue, assignee, watchers, status))
        );
        break;

      case "ASSIGNED_NOT_PROGRESSING":
        suggestions.push(
          ...(await getNotProgressingSuggestions(issue, assignee, watchers))
        );
        break;

      case "HAS_BLOCKERS":
        suggestions.push(...getBlockerSuggestions(blockers, reason.blockers));
        break;

      case "STATUS_BLOCKED":
        suggestions.push(...getExplicitBlockedSuggestions(issue, blockers));
        break;

      case "NO_HUMAN_INTERACTION":
        suggestions.push(
          ...getNoInteractionSuggestions(issue, assignee, reporter, watchers)
        );
        break;

      case "NO_COMMENTS":
        suggestions.push(
          ...getNoCommentsSuggestions(issue, reporter, assignee)
        );
        break;
    }
  }

  // Add suggestions based on changelog patterns
  if (changelogAnalysis?.patterns) {
    for (const pattern of changelogAnalysis.patterns) {
      suggestions.push(...getPatternSuggestions(pattern, issue));
    }
  }

  // Add suggestions based on linked issues
  if (linkedIssues.length > 0) {
    suggestions.push(...getLinkedIssueSuggestions(linkedIssues, issue));
  }

  // Add priority-based suggestions
  if (priority === "Critical" || priority === "Highest") {
    suggestions.push({
      type: "PRIORITY_ESCALATION",
      icon: "🚨",
      action: "Escalate to team lead or product owner",
      reason: `${priority} priority issue is stalled`,
      confidence: "HIGH",
    });
  }

  // Remove duplicates and prioritize
  const uniqueSuggestions = deduplicateSuggestions(suggestions);
  const prioritized = prioritizeSuggestions(uniqueSuggestions);

  console.log(`✅ Generated ${prioritized.length} contextual suggestions`);

  return prioritized.slice(0, 5); // Return top 5 suggestions
}

/**
 * Suggestions for unassigned issues
 */
async function getUnassignedSuggestions(issue, watchers, reporter) {
  const suggestions = [];

  // Suggest assigning to reporter if they're active
  if (reporter && reporter.active) {
    suggestions.push({
      type: "ASSIGN_TO_REPORTER",
      icon: "👤",
      action: `Assign to reporter: @${reporter.displayName}`,
      reason: "They created this issue and may have context",
      confidence: "MEDIUM",
      user: reporter,
    });
  }

  // Suggest assigning to most active watcher
  if (watchers.length > 0) {
    suggestions.push({
      type: "ASSIGN_TO_WATCHER",
      icon: "👥",
      action: `Assign to watcher: @${watchers[0].displayName}`,
      reason: "They're watching this issue and may be interested",
      confidence: "MEDIUM",
      user: watchers[0],
    });
  }

  // General assignment suggestion
  suggestions.push({
    type: "ASSIGN_ISSUE",
    icon: "🎯",
    action: "Assign this issue to someone on the team",
    reason: "Unassigned issues rarely make progress",
    confidence: "HIGH",
  });

  return suggestions;
}

/**
 * Suggestions for issues with no activity
 */
async function getNoActivitySuggestions(issue, assignee, watchers, status) {
  const suggestions = [];

  if (assignee && assignee.active) {
    suggestions.push({
      type: "PING_ASSIGNEE",
      icon: "📣",
      action: `Ping assignee: @${assignee.displayName}`,
      reason: "Check if they're blocked or need help",
      confidence: "HIGH",
      user: assignee,
    });
  }

  // Status-specific suggestions
  if (status === "In Review" || status === "Code Review") {
    const reviewers = watchers.filter(
      (w) => w.accountId !== assignee?.accountId
    );
    if (reviewers.length > 0) {
      const reviewerNames = reviewers
        .slice(0, 3)
        .map((r) => `@${r.displayName}`)
        .join(", ");
      suggestions.push({
        type: "PING_REVIEWERS",
        icon: "👀",
        action: `Ping reviewers: ${reviewerNames}`,
        reason: "Code review is taking too long",
        confidence: "HIGH",
        users: reviewers.slice(0, 3),
      });
    }
  }

  if (status === "To Do" || status === "Backlog") {
    suggestions.push({
      type: "REPRIORITIZE",
      icon: "📊",
      action: "Review priority and sprint assignment",
      reason: "Issue may need to be reprioritized or moved",
      confidence: "MEDIUM",
    });
  }

  return suggestions;
}

/**
 * Suggestions for assigned but not progressing
 */
async function getNotProgressingSuggestions(issue, assignee, watchers) {
  const suggestions = [];

  if (assignee) {
    suggestions.push({
      type: "CHECK_WORKLOAD",
      icon: "💼",
      action: `Check ${assignee.displayName}'s workload`,
      reason: "They may be overloaded or blocked",
      confidence: "HIGH",
      user: assignee,
    });

    suggestions.push({
      type: "OFFER_HELP",
      icon: "🤝",
      action: `Offer help to @${assignee.displayName}`,
      reason: "Pair programming or knowledge sharing might unblock them",
      confidence: "MEDIUM",
      user: assignee,
    });
  }

  // Suggest reassignment if stalled too long
  const otherTeamMembers = watchers.filter(
    (w) => w.accountId !== assignee?.accountId
  );
  if (otherTeamMembers.length > 0) {
    suggestions.push({
      type: "CONSIDER_REASSIGNMENT",
      icon: "🔄",
      action: `Consider reassigning to @${otherTeamMembers[0].displayName}`,
      reason: "Fresh perspective might help",
      confidence: "LOW",
      user: otherTeamMembers[0],
    });
  }

  return suggestions;
}

/**
 * Suggestions for issues with blockers
 */
function getBlockerSuggestions(blockers, blockerKeys) {
  const suggestions = [];

  if (blockers.length > 0) {
    blockers.forEach((blocker) => {
      const blockerStatus = blocker.fields?.status?.name || "Unknown";
      suggestions.push({
        type: "RESOLVE_BLOCKER",
        icon: "🔓",
        action: `Check blocker ${blocker.key} (${blockerStatus})`,
        reason: "This must be resolved before progress can continue",
        confidence: "CRITICAL",
        blockerKey: blocker.key,
        blockerStatus,
      });
    });
  } else if (blockerKeys?.length > 0) {
    // We have blocker keys but couldn't fetch details
    blockerKeys.forEach((key) => {
      suggestions.push({
        type: "RESOLVE_BLOCKER",
        icon: "🔓",
        action: `Check blocker ${key}`,
        reason: "This must be resolved before progress can continue",
        confidence: "CRITICAL",
        blockerKey: key,
      });
    });
  }

  return suggestions;
}

/**
 * Suggestions for explicitly blocked status
 */
function getExplicitBlockedSuggestions(issue, blockers) {
  const suggestions = [];

  suggestions.push({
    type: "DOCUMENT_BLOCKER",
    icon: "📝",
    action: "Document what's blocking this issue",
    reason: "Clear documentation helps resolve blockers faster",
    confidence: "HIGH",
  });

  if (blockers.length === 0) {
    suggestions.push({
      type: "LINK_BLOCKER",
      icon: "🔗",
      action: "Link the blocking issue(s) in Jira",
      reason: "This helps track dependencies",
      confidence: "HIGH",
    });
  }

  suggestions.push({
    type: "ESCALATE_BLOCKER",
    icon: "📢",
    action: "Escalate to team lead or stakeholder",
    reason: "External blockers may need management attention",
    confidence: "MEDIUM",
  });

  return suggestions;
}

/**
 * Suggestions for no human interaction
 */
function getNoInteractionSuggestions(issue, assignee, reporter, watchers) {
  const suggestions = [];

  if (reporter) {
    suggestions.push({
      type: "ASK_REPORTER",
      icon: "❓",
      action: `Ask ${reporter.displayName} for clarification`,
      reason: "They created this and may have additional context",
      confidence: "MEDIUM",
      user: reporter,
    });
  }

  if (assignee && assignee.accountId !== reporter?.accountId) {
    suggestions.push({
      type: "REQUEST_UPDATE",
      icon: "💬",
      action: `Request status update from @${assignee.displayName}`,
      reason: "Regular communication prevents issues from going stale",
      confidence: "HIGH",
      user: assignee,
    });
  }

  suggestions.push({
    type: "TEAM_DISCUSSION",
    icon: "👥",
    action: "Bring this up in standup or team meeting",
    reason: "Team input might unblock this issue",
    confidence: "MEDIUM",
  });

  return suggestions;
}

/**
 * Suggestions for issues with no comments
 */
function getNoCommentsSuggestions(issue, reporter, assignee) {
  const suggestions = [];

  suggestions.push({
    type: "ADD_CONTEXT",
    icon: "📄",
    action: "Add acceptance criteria or requirements",
    reason: "Clear requirements prevent confusion and delays",
    confidence: "HIGH",
  });

  if (reporter) {
    suggestions.push({
      type: "CLARIFY_REQUIREMENTS",
      icon: "🔍",
      action: `Ask ${reporter.displayName} to clarify requirements`,
      reason: "Missing details may be causing delays",
      confidence: "MEDIUM",
      user: reporter,
    });
  }

  return suggestions;
}

/**
 * Suggestions based on changelog patterns
 */
function getPatternSuggestions(pattern, issue) {
  const suggestions = [];

  switch (pattern.type) {
    case "STATUS_THRASHING":
      suggestions.push({
        type: "TEAM_SYNC",
        icon: "🔄",
        action: "Schedule quick team sync to align on direction",
        reason: "Status changed too frequently - may indicate confusion",
        confidence: "HIGH",
      });
      break;

    case "STATUS_PING_PONG":
      suggestions.push({
        type: "CLARIFY_WORKFLOW",
        icon: "📋",
        action: "Clarify the workflow or definition of done",
        reason: "Status bouncing back and forth indicates process issues",
        confidence: "HIGH",
      });
      break;

    case "ASSIGNMENT_CHURNING":
      suggestions.push({
        type: "ASSIGN_OWNER",
        icon: "👑",
        action: "Assign a clear owner and stick with them",
        reason: "Too many reassignments cause loss of context",
        confidence: "HIGH",
      });
      break;

    case "MULTIPLE_REOPENS":
      suggestions.push({
        type: "ROOT_CAUSE",
        icon: "🔬",
        action: "Investigate root cause of why this keeps reopening",
        reason: "Multiple reopens suggest incomplete fixes",
        confidence: "CRITICAL",
      });
      break;
  }

  return suggestions;
}

/**
 * Suggestions based on linked issues
 */
function getLinkedIssueSuggestions(linkedIssues, issue) {
  const suggestions = [];

  const openDependencies = linkedIssues.filter(
    (l) =>
      l.type === "depends on" && l.status !== "Done" && l.status !== "Closed"
  );

  if (openDependencies.length > 0) {
    const depKeys = openDependencies.map((d) => d.key).join(", ");
    suggestions.push({
      type: "CHECK_DEPENDENCIES",
      icon: "🔗",
      action: `Check dependencies: ${depKeys}`,
      reason: "These dependencies may be causing delays",
      confidence: "HIGH",
      dependencies: openDependencies,
    });
  }

  return suggestions;
}

/**
 * Remove duplicate suggestions
 */
function deduplicateSuggestions(suggestions) {
  const seen = new Set();
  return suggestions.filter((s) => {
    const key = `${s.type}-${s.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Prioritize suggestions by confidence and type
 */
function prioritizeSuggestions(suggestions) {
  const confidenceOrder = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  return suggestions.sort((a, b) => {
    return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
  });
}

/**
 * Format suggestions for display
 */
export function formatSuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    return "";
  }

  let message = "**💡 Suggested Actions:**\n";

  suggestions.forEach((suggestion, index) => {
    message += `${suggestion.icon} ${suggestion.action}\n`;
    if (suggestion.reason) {
      message += `   _${suggestion.reason}_\n`;
    }
  });

  return message;
}

// --- Helper Functions to Fetch Context ---

async function getBlockingIssues(issueId) {
  try {
    const response = await api
      .asApp()
      .requestJira(route`/rest/api/3/issue/${issueId}?fields=issuelinks`);

    if (!response.ok) return [];

    const data = await response.json();
    const issueLinks = data.fields.issuelinks || [];

    const blockers = [];
    for (const link of issueLinks) {
      if (link.type.inward === "is blocked by" && link.outwardIssue) {
        blockers.push(link.outwardIssue);
      }
      if (link.type.name === "Blocks" && link.inwardIssue) {
        blockers.push(link.inwardIssue);
      }
    }

    return blockers;
  } catch (error) {
    console.error("Error fetching blockers:", error.message);
    return [];
  }
}

async function getWatchers(issueId) {
  try {
    const response = await api
      .asApp()
      .requestJira(route`/rest/api/3/issue/${issueId}/watchers`);

    if (!response.ok) return [];

    const data = await response.json();
    return data.watchers || [];
  } catch (error) {
    console.error("Error fetching watchers:", error.message);
    return [];
  }
}

async function getLinkedIssues(issueId) {
  try {
    const response = await api
      .asApp()
      .requestJira(route`/rest/api/3/issue/${issueId}?fields=issuelinks`);

    if (!response.ok) return [];

    const data = await response.json();
    const issueLinks = data.fields.issuelinks || [];

    const linked = [];
    for (const link of issueLinks) {
      if (link.outwardIssue) {
        linked.push({
          key: link.outwardIssue.key,
          type: link.type.outward,
          status: link.outwardIssue.fields?.status?.name,
        });
      }
      if (link.inwardIssue) {
        linked.push({
          key: link.inwardIssue.key,
          type: link.type.inward,
          status: link.inwardIssue.fields?.status?.name,
        });
      }
    }

    return linked;
  } catch (error) {
    console.error("Error fetching linked issues:", error.message);
    return [];
  }
}
