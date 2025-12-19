// src/dashboardMetrics.js
import api, { route } from "@forge/api";
import { isStalled } from "./telemetry.js";
import { getSettings } from "./configManager.js";

/**
 * Get dashboard metrics for all active issues
 */
export async function getDashboardMetrics() {
  console.log("📊 [dashboardResolver] Fetching dashboard metrics...");

  try {
    const settings = await getSettings();
    const activeStatuses = settings.activeStatuses || [
      "In Progress",
      "In Review",
      "Code Review",
      "To Do",
      "Blocked",
      "Testing",
      "QA",
    ];

    // Fetch all active issues
    const statusFilter = activeStatuses.map((s) => `"${s}"`).join(",");
    const jql = `status in (${statusFilter}) ORDER BY updated ASC`;

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
          maxResults: 100, // Adjust based on your needs
          fields: [
            "id",
            "key",
            "status",
            "assignee",
            "updated",
            "created",
            "priority",
          ],
        }),
      });

    if (!response.ok) {
      console.error("Failed to fetch issues for dashboard");
      return getEmptyMetrics();
    }

    const data = await response.json();
    const issues = data.issues || [];

    console.log(`📈 Analyzing ${issues.length} issues for metrics...`);

    // Analyze each issue
    const metrics = {
      totalIssues: issues.length,
      stalledIssues: 0,
      healthyIssues: 0,
      byStatus: {},
      byAssignee: {},
      bySeverity: {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      },
      stallReasons: {},
      averageStallTime: 0,
      longestStalled: null,
      recentlyStalled: [],
    };

    let totalStallTime = 0;
    const stalledIssuesList = [];

    // Process each issue
    for (const issue of issues) {
      const status = issue.fields.status.name;
      const assignee = issue.fields.assignee?.displayName || "Unassigned";
      const updated = new Date(issue.fields.updated);
      const now = new Date();
      const hoursSinceUpdate = (now - updated) / (1000 * 60 * 60);

      // Initialize status counter
      if (!metrics.byStatus[status]) {
        metrics.byStatus[status] = { total: 0, stalled: 0, healthy: 0 };
      }
      metrics.byStatus[status].total++;

      // Initialize assignee counter
      if (!metrics.byAssignee[assignee]) {
        metrics.byAssignee[assignee] = { total: 0, stalled: 0, healthy: 0 };
      }
      metrics.byAssignee[assignee].total++;

      // Fetch full issue details for stall detection
      try {
        const fullIssue = await getIssueDetails(issue.id);
        if (!fullIssue) continue;

        const stallInfo = await isStalled(fullIssue);

        if (stallInfo.isStalled) {
          metrics.stalledIssues++;
          metrics.byStatus[status].stalled++;
          metrics.byAssignee[assignee].stalled++;
          metrics.bySeverity[stallInfo.severity]++;

          totalStallTime += hoursSinceUpdate;

          // Track stall reasons
          stallInfo.reasons.forEach((reason) => {
            if (!metrics.stallReasons[reason.type]) {
              metrics.stallReasons[reason.type] = 0;
            }
            metrics.stallReasons[reason.type]++;
          });

          const stalledItem = {
            key: issue.key,
            status,
            assignee,
            hoursSinceUpdate: Math.floor(hoursSinceUpdate),
            severity: stallInfo.severity,
            reasons: stallInfo.reasons.map((r) => r.type),
          };

          stalledIssuesList.push(stalledItem);

          // Track longest stalled
          if (
            !metrics.longestStalled ||
            hoursSinceUpdate > metrics.longestStalled.hoursSinceUpdate
          ) {
            metrics.longestStalled = stalledItem;
          }
        } else {
          metrics.healthyIssues++;
          metrics.byStatus[status].healthy++;
          metrics.byAssignee[assignee].healthy++;
        }

        // Small delay to avoid rate limiting
        await sleep(50);
      } catch (error) {
        console.error(`Error analyzing ${issue.key}:`, error.message);
      }
    }

    // Calculate average stall time
    if (metrics.stalledIssues > 0) {
      metrics.averageStallTime = Math.floor(
        totalStallTime / metrics.stalledIssues
      );
    }

    // Sort and get recently stalled (top 10)
    metrics.recentlyStalled = stalledIssuesList
      .sort((a, b) => a.hoursSinceUpdate - b.hoursSinceUpdate)
      .slice(0, 10);

    console.log(`✅ Dashboard metrics calculated:`, {
      total: metrics.totalIssues,
      stalled: metrics.stalledIssues,
      healthy: metrics.healthyIssues,
    });

    return metrics;
  } catch (error) {
    console.error("❌ [dashboardResolver] Error:", error);
    return getEmptyMetrics();
  }
}

/**
 * Get issue details
 */
async function getIssueDetails(issueId) {
  try {
    const response = await api
      .asApp()
      .requestJira(
        route`/rest/api/3/issue/${issueId}?fields=status,assignee,created,updated,comment,issuelinks,summary,description,priority`
      );

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Error fetching issue:", error.message);
    return null;
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get empty metrics structure
 */
function getEmptyMetrics() {
  return {
    totalIssues: 0,
    stalledIssues: 0,
    healthyIssues: 0,
    byStatus: {},
    byAssignee: {},
    bySeverity: {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    },
    stallReasons: {},
    averageStallTime: 0,
    longestStalled: null,
    recentlyStalled: [],
  };
}
