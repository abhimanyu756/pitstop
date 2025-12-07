/**
 * Configuration for Pit Stop
 */

// Stall detection thresholds (in hours)
export const STALL_THRESHOLDS = {
  // 🧪 TEST MODE - Uncomment for instant testing
  "In Progress": 0.01, // ~30 seconds
  "In Review": 0.01,
  "Code Review": 0.01,
  "To Do": 0.01,
  Blocked: 0.01,
  default: 0.01,

  // 🚀 PRODUCTION MODE - Real thresholds
  //   "In Progress": 48, // 2 days
  //   "In Review": 24, // 1 day
  //   "Code Review": 24, // 1 day
  //   "To Do": 168, // 1 week
  //   Backlog: 336, // 2 weeks
  //   Blocked: 12, // 12 hours (should be resolved quickly)
  //   Testing: 48, // 2 days
  //   QA: 48, // 2 days
  //   default: 72, // 3 days for any other status
};

// Time without human comment threshold (in hours)
//export const NO_HUMAN_COMMENT_THRESHOLD = 96; // 4 days
export const NO_HUMAN_COMMENT_THRESHOLD = 0.01;

// Statuses to monitor for stalls
export const ACTIVE_STATUSES = [
  "In Progress",
  "In Review",
  "Code Review",
  "To Do",
  "Blocked",
  "Testing",
  "QA",
];

// Maximum issues to process per scheduled run
export const MAX_ISSUES_PER_RUN = 50;

// Minimum time between bot comments on same issue (in hours)
export const COMMENT_COOLDOWN_HOURS = 24;

// Scanner settings
export const SCANNER_CONFIG = {
  enabled: true,
  maxIssuesPerRun: MAX_ISSUES_PER_RUN,
  delayBetweenIssues: 100, // milliseconds
};

// Feature flags
export const FEATURES = {
  detectNoActivity: true,
  detectNoHumanComments: true,
  detectUnassigned: true,
  detectBlockers: true,
  detectAssignedNotProgressing: true,
  postComments: true, // Set to false to run in "dry run" mode

  // 🎯 NEW: Smart Comment Response Features
  postStallWarnings: true, // Post warnings when users comment on stalled issues
  postEncouragement: true, // Post encouraging messages on healthy issues (set to true to enable)
  encouragementChance: 0.3, // 30% chance to post encouragement (prevents spam)
};

// 🎯 Smart Response Settings
export const SMART_RESPONSE_CONFIG = {
  // When to respond to comments
  respondToStalled: true, // Always respond if issue is stalled
  respondToHealthy: false, // Only respond to healthy issues sometimes

  // Encouragement settings
  encourageAssignees: true, // Encourage when assignee comments
  encourageRecentActivity: true, // Encourage recent activity (< 2 hours)

  // Message tone
  useFriendlyTone: true, // Use emojis and casual language
  includeActionables: true, // Include actionable suggestions

  // Cooldown between responses (hours)
  cooldownHours: COMMENT_COOLDOWN_HOURS,
};
