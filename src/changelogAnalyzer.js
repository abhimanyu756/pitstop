/**
 * Feature 2.1: Changelog Analysis
 * Analyzes issue history to detect meaningful vs noise updates
 */

import api, { route } from "@forge/api";

// Bot account patterns (these typically create "noise")
const BOT_PATTERNS = [
  "automation",
  "bot",
  "jira",
  "service",
  "system",
  "[bot]",
  "forge-app",
];

// Meaningful change types (signal)
const MEANINGFUL_CHANGES = [
  "status",
  "assignee",
  "priority",
  "resolution",
  "Sprint",
  "Fix Version",
  "labels",
  "description",
];

// Noise change types (ignore these)
const NOISE_CHANGES = [
  "Rank",
  "timeestimate",
  "timespent",
  "worklog",
  "attachment", // Unless explicitly tracked
];

/**
 * Main function to analyze changelog and extract intelligence
 */
export async function analyzeChangelog(issueId) {
  try {
    console.log(`📊 Analyzing changelog for issue ${issueId}`);

    const changelog = await fetchChangelog(issueId);

    if (!changelog || changelog.length === 0) {
      return {
        lastMeaningfulUpdate: null,
        lastMeaningfulUpdateBy: null,
        totalChanges: 0,
        meaningfulChanges: 0,
        noiseChanges: 0,
        patterns: [],
        timeline: [],
      };
    }

    const analysis = {
      lastMeaningfulUpdate: null,
      lastMeaningfulUpdateBy: null,
      totalChanges: 0,
      meaningfulChanges: 0,
      noiseChanges: 0,
      patterns: [],
      timeline: [],
      statusHistory: [],
      assignmentHistory: [],
      thrashing: false,
    };

    const now = new Date();
    const statusChanges = [];
    const assignments = [];

    // Analyze each changelog entry
    for (const entry of changelog) {
      analysis.totalChanges++;

      const author = entry.author?.displayName || "Unknown";
      const created = new Date(entry.created);
      const isBot = isBotUser(entry.author);

      // Process each item in the changelog entry
      for (const item of entry.items || []) {
        const field = item.field;
        const fieldType = item.fieldtype;
        const fromValue = item.fromString;
        const toValue = item.toString;

        // Check if this is a meaningful change
        const isMeaningful = MEANINGFUL_CHANGES.includes(field) && !isBot;
        const isNoise = NOISE_CHANGES.includes(field) || isBot;

        if (isMeaningful) {
          analysis.meaningfulChanges++;

          // Track last meaningful update
          if (
            !analysis.lastMeaningfulUpdate ||
            created > analysis.lastMeaningfulUpdate
          ) {
            analysis.lastMeaningfulUpdate = created;
            analysis.lastMeaningfulUpdateBy = author;
          }

          // Build timeline
          analysis.timeline.push({
            date: created,
            author,
            field,
            from: fromValue,
            to: toValue,
            type: "meaningful",
          });

          // Track status changes
          if (field === "status") {
            statusChanges.push({
              date: created,
              from: fromValue,
              to: toValue,
              author,
            });
            analysis.statusHistory.push({
              status: toValue,
              date: created,
              author,
            });
          }

          // Track assignments
          if (field === "assignee") {
            assignments.push({
              date: created,
              from: fromValue,
              to: toValue,
              author,
            });
            analysis.assignmentHistory.push({
              assignee: toValue,
              date: created,
              author,
            });
          }
        } else if (isNoise) {
          analysis.noiseChanges++;
        }
      }
    }

    // Detect patterns
    analysis.patterns = detectPatterns(statusChanges, assignments, now);
    analysis.thrashing = analysis.patterns.some(
      (p) => p.type === "STATUS_THRASHING"
    );

    console.log(
      `✅ Changelog analysis complete: ${analysis.meaningfulChanges} meaningful, ${analysis.noiseChanges} noise`
    );

    return analysis;
  } catch (error) {
    console.error("Error analyzing changelog:", error.message);
    return null;
  }
}

/**
 * Fetch full changelog from Jira
 */
async function fetchChangelog(issueId) {
  try {
    // Fetch changelog with expand
    const response = await api
      .asApp()
      .requestJira(
        route`/rest/api/3/issue/${issueId}?expand=changelog&fields=none`
      );

    if (!response.ok) {
      console.error("Failed to fetch changelog");
      return [];
    }

    const data = await response.json();
    const histories = data.changelog?.histories || [];

    // Sort by date descending (most recent first)
    return histories.sort((a, b) => new Date(b.created) - new Date(a.created));
  } catch (error) {
    console.error("Error fetching changelog:", error.message);
    return [];
  }
}

/**
 * Check if a user is a bot
 */
function isBotUser(author) {
  if (!author) return true;

  const displayName = (author.displayName || "").toLowerCase();
  const accountType = author.accountType || "";

  // Check account type
  if (accountType === "app" || accountType === "system") {
    return true;
  }

  // Check name patterns
  return BOT_PATTERNS.some((pattern) => displayName.includes(pattern));
}

/**
 * Detect patterns in changelog (thrashing, ping-pong, etc.)
 */
function detectPatterns(statusChanges, assignments, now) {
  const patterns = [];

  // Pattern 1: Status Thrashing
  // Status changed 5+ times in 48 hours
  if (statusChanges.length >= 5) {
    const recentChanges = statusChanges.filter((change) => {
      const hoursSince = (now - change.date) / (1000 * 60 * 60);
      return hoursSince < 48;
    });

    if (recentChanges.length >= 5) {
      const statuses = recentChanges.map((c) => c.to).join(" → ");
      patterns.push({
        type: "STATUS_THRASHING",
        severity: "HIGH",
        message: `Status changed ${recentChanges.length} times in 48 hours: ${statuses}`,
        count: recentChanges.length,
        timeframe: "48 hours",
        details: recentChanges,
      });
    }
  }

  // Pattern 2: Status Ping-Pong
  // Status goes back and forth between same two states
  if (statusChanges.length >= 3) {
    const recent = statusChanges.slice(0, 5);
    const uniqueStatuses = [...new Set(recent.map((c) => c.to))];

    if (uniqueStatuses.length === 2) {
      patterns.push({
        type: "STATUS_PING_PONG",
        severity: "MEDIUM",
        message: `Status bouncing between ${uniqueStatuses.join(" ↔ ")}`,
        statuses: uniqueStatuses,
        count: recent.length,
        details: recent,
      });
    }
  }

  // Pattern 3: Assignment Churning
  // Reassigned 3+ times in short period
  if (assignments.length >= 3) {
    const recentAssignments = assignments.filter((a) => {
      const hoursSince = (now - a.date) / (1000 * 60 * 60);
      return hoursSince < 168; // 1 week
    });

    if (recentAssignments.length >= 3) {
      const assignees = recentAssignments.map((a) => a.to || "Unassigned");
      patterns.push({
        type: "ASSIGNMENT_CHURNING",
        severity: "MEDIUM",
        message: `Reassigned ${
          recentAssignments.length
        } times: ${assignees.join(" → ")}`,
        count: recentAssignments.length,
        assignees,
        details: recentAssignments,
      });
    }
  }

  // Pattern 4: Reopened Multiple Times
  const reopens = statusChanges.filter(
    (c) =>
      c.to.toLowerCase().includes("open") ||
      c.to.toLowerCase().includes("reopened")
  );

  if (reopens.length >= 2) {
    patterns.push({
      type: "MULTIPLE_REOPENS",
      severity: "HIGH",
      message: `Issue reopened ${reopens.length} times - may indicate quality issues`,
      count: reopens.length,
      details: reopens,
    });
  }

  // Pattern 5: Stuck in Status
  // Current status for very long time with no other changes
  if (statusChanges.length > 0) {
    const lastStatusChange = statusChanges[0];
    const hoursSince = (now - lastStatusChange.date) / (1000 * 60 * 60);

    if (hoursSince > 168) {
      // 1 week
      const daysSince = Math.floor(hoursSince / 24);
      patterns.push({
        type: "STUCK_IN_STATUS",
        severity: "MEDIUM",
        message: `Stuck in '${lastStatusChange.to}' for ${daysSince} days`,
        status: lastStatusChange.to,
        days: daysSince,
        details: lastStatusChange,
      });
    }
  }

  return patterns;
}

/**
 * Calculate real last activity time (ignoring noise)
 */
export function getRealLastActivity(issue, changelogAnalysis) {
  if (!changelogAnalysis) {
    return new Date(issue.fields.updated);
  }

  // Use last meaningful update if available
  if (changelogAnalysis.lastMeaningfulUpdate) {
    return changelogAnalysis.lastMeaningfulUpdate;
  }

  // Fall back to issue updated time
  return new Date(issue.fields.updated);
}

/**
 * Format changelog insights for display
 */
export function formatChangelogInsights(analysis) {
  if (!analysis || analysis.meaningfulChanges === 0) {
    return null;
  }

  let message = "";

  // Add pattern warnings
  if (analysis.patterns.length > 0) {
    message += "**⚠️ Patterns Detected:**\n";
    analysis.patterns.forEach((pattern) => {
      const emoji = pattern.severity === "HIGH" ? "🚨" : "⚠️";
      message += `${emoji} ${pattern.message}\n`;
    });
    message += "\n";
  }

  // Add activity summary
  if (analysis.lastMeaningfulUpdate) {
    const hoursSince =
      (new Date() - analysis.lastMeaningfulUpdate) / (1000 * 60 * 60);
    const daysSince = Math.floor(hoursSince / 24);

    if (daysSince > 0) {
      message += `📊 Last meaningful update: ${daysSince} day(s) ago by ${analysis.lastMeaningfulUpdateBy}\n`;
    } else {
      message += `📊 Last meaningful update: ${Math.floor(
        hoursSince
      )} hour(s) ago by ${analysis.lastMeaningfulUpdateBy}\n`;
    }
  }

  return message;
}
