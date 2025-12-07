/**
 * Feature 2.3: Configurable Thresholds - Storage Manager
 * Manages threshold configuration using Forge Storage
 */

import { storage } from "@forge/api";

// Default thresholds (fallback if no custom config)
const DEFAULT_THRESHOLDS = {
  "In Progress": 48, // 2 days
  "In Review": 24, // 1 day
  "Code Review": 24, // 1 day
  "To Do": 168, // 1 week
  Backlog: 336, // 2 weeks
  Blocked: 12, // 12 hours
  Testing: 48, // 2 days
  QA: 48, // 2 days
  default: 72, // 3 days
};

const CONFIG_KEY = "pit-stop-config";
const THRESHOLDS_KEY = "status-thresholds";
const SETTINGS_KEY = "general-settings";

/**
 * Get all threshold configurations
 */
export async function getThresholds() {
  try {
    const config = await storage.get(CONFIG_KEY);

    if (!config || !config[THRESHOLDS_KEY]) {
      console.log("No custom thresholds found, using defaults");
      return DEFAULT_THRESHOLDS;
    }

    console.log("Loaded custom thresholds from storage");
    return config[THRESHOLDS_KEY];
  } catch (error) {
    console.error("Error loading thresholds:", error.message);
    return DEFAULT_THRESHOLDS;
  }
}

/**
 * Get threshold for a specific status
 */
export async function getThresholdForStatus(status) {
  const thresholds = await getThresholds();
  return thresholds[status] || thresholds["default"] || 72;
}

/**
 * Set thresholds for multiple statuses
 */
export async function setThresholds(thresholds) {
  try {
    const config = (await storage.get(CONFIG_KEY)) || {};
    config[THRESHOLDS_KEY] = thresholds;
    await storage.set(CONFIG_KEY, config);

    console.log("✅ Thresholds saved to storage");
    return { success: true, thresholds };
  } catch (error) {
    console.error("Error saving thresholds:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Set threshold for a single status
 */
export async function setThresholdForStatus(status, hours) {
  try {
    const thresholds = await getThresholds();
    thresholds[status] = hours;
    return await setThresholds(thresholds);
  } catch (error) {
    console.error("Error setting threshold:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Reset all thresholds to defaults
 */
export async function resetThresholds() {
  try {
    const config = (await storage.get(CONFIG_KEY)) || {};
    config[THRESHOLDS_KEY] = { ...DEFAULT_THRESHOLDS };
    await storage.set(CONFIG_KEY, config);

    console.log("✅ Thresholds reset to defaults");
    return { success: true, thresholds: DEFAULT_THRESHOLDS };
  } catch (error) {
    console.error("Error resetting thresholds:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get general settings
 */
export async function getSettings() {
  try {
    const config = await storage.get(CONFIG_KEY);

    if (!config || !config[SETTINGS_KEY]) {
      return getDefaultSettings();
    }

    return config[SETTINGS_KEY];
  } catch (error) {
    console.error("Error loading settings:", error.message);
    return getDefaultSettings();
  }
}

/**
 * Save general settings
 */
export async function setSettings(settings) {
  try {
    const config = (await storage.get(CONFIG_KEY)) || {};
    config[SETTINGS_KEY] = settings;
    await storage.set(CONFIG_KEY, config);

    console.log("✅ Settings saved to storage");
    return { success: true, settings };
  } catch (error) {
    console.error("Error saving settings:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get default settings
 */
function getDefaultSettings() {
  return {
    noHumanCommentThreshold: 96, // 4 days
    commentCooldownHours: 24,
    maxIssuesPerRun: 50,
    features: {
      detectNoActivity: true,
      detectNoHumanComments: true,
      detectUnassigned: true,
      detectBlockers: true,
      detectAssignedNotProgressing: true,
      postComments: true,
      postStallWarnings: true,
      postEncouragement: false,
      useChangelogAnalysis: true,
      useContextualSuggestions: true,
    },
    activeStatuses: [
      "In Progress",
      "In Review",
      "Code Review",
      "To Do",
      "Blocked",
      "Testing",
      "QA",
    ],
  };
}

/**
 * Export configuration for display/debugging
 */
export async function exportConfig() {
  try {
    const config = await storage.get(CONFIG_KEY);
    return (
      config || {
        [THRESHOLDS_KEY]: DEFAULT_THRESHOLDS,
        [SETTINGS_KEY]: getDefaultSettings(),
      }
    );
  } catch (error) {
    console.error("Error exporting config:", error.message);
    return null;
  }
}

/**
 * Import configuration from JSON
 */
export async function importConfig(configJson) {
  try {
    await storage.set(CONFIG_KEY, configJson);
    console.log("✅ Configuration imported successfully");
    return { success: true };
  } catch (error) {
    console.error("Error importing config:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get all available statuses from Jira project
 */
export async function getAvailableStatuses(projectKey) {
  // This would need to fetch from Jira API
  // For now, return common statuses
  return [
    "To Do",
    "In Progress",
    "In Review",
    "Code Review",
    "Testing",
    "QA",
    "Blocked",
    "Done",
    "Closed",
    "Backlog",
  ];
}
