import { storage } from "@forge/api";

// Default thresholds (fallback if no custom config)
const DEFAULT_THRESHOLDS = {
  "In Progress": 48,
  "In Review": 24,
  "Code Review": 24,
  "To Do": 168,
  Backlog: 336,
  Blocked: 12,
  Testing: 48,
  QA: 48,
  default: 72,
};

const CONFIG_KEY = "pit-stop-config";
const THRESHOLDS_KEY = "status-thresholds";
const SETTINGS_KEY = "general-settings";

/**
 * Get all threshold configurations
 */
export async function getThresholds() {
  console.log("📖 [configManager] getThresholds called");

  try {
    const config = await storage.get(CONFIG_KEY);
    console.log("  - Raw storage data:", JSON.stringify(config, null, 2));

    if (!config || !config[THRESHOLDS_KEY]) {
      console.log("  - No custom thresholds, using defaults");
      return DEFAULT_THRESHOLDS;
    }

    console.log(
      "  - Loaded custom thresholds:",
      JSON.stringify(config[THRESHOLDS_KEY], null, 2)
    );
    return config[THRESHOLDS_KEY];
  } catch (error) {
    console.error("❌ [configManager] getThresholds error:", error);
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
  console.log("💾 [configManager] setThresholds called");
  console.log("  - New thresholds:", JSON.stringify(thresholds, null, 2));

  try {
    const config = (await storage.get(CONFIG_KEY)) || {};
    console.log("  - Existing config:", JSON.stringify(config, null, 2));

    config[THRESHOLDS_KEY] = thresholds;

    await storage.set(CONFIG_KEY, config);
    console.log("  - Saved to storage successfully");

    // Verify save
    const verify = await storage.get(CONFIG_KEY);
    console.log(
      "  - Verification read:",
      JSON.stringify(verify[THRESHOLDS_KEY], null, 2)
    );

    return { success: true, thresholds };
  } catch (error) {
    console.error("❌ [configManager] setThresholds error:", error);
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
    console.error("❌ [configManager] setThresholdForStatus error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Reset all thresholds to defaults
 */
export async function resetThresholds() {
  console.log("🔄 [configManager] resetThresholds called");

  try {
    const config = (await storage.get(CONFIG_KEY)) || {};
    config[THRESHOLDS_KEY] = { ...DEFAULT_THRESHOLDS };
    await storage.set(CONFIG_KEY, config);

    console.log("✅ [configManager] Thresholds reset to defaults");
    return { success: true, thresholds: DEFAULT_THRESHOLDS };
  } catch (error) {
    console.error("❌ [configManager] resetThresholds error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get general settings
 */
export async function getSettings() {
  console.log("📖 [configManager] getSettings called");

  try {
    const config = await storage.get(CONFIG_KEY);
    console.log("  - Raw storage data:", JSON.stringify(config, null, 2));

    if (!config || !config[SETTINGS_KEY]) {
      console.log("  - No custom settings, using defaults");
      return getDefaultSettings();
    }

    console.log(
      "  - Loaded custom settings:",
      JSON.stringify(config[SETTINGS_KEY], null, 2)
    );
    return config[SETTINGS_KEY];
  } catch (error) {
    console.error("❌ [configManager] getSettings error:", error);
    return getDefaultSettings();
  }
}

/**
 * Save general settings
 */
export async function setSettings(settings) {
  console.log("💾 [configManager] setSettings called");
  console.log("  - New settings:", JSON.stringify(settings, null, 2));

  try {
    const config = (await storage.get(CONFIG_KEY)) || {};
    console.log("  - Existing config:", JSON.stringify(config, null, 2));

    config[SETTINGS_KEY] = settings;

    await storage.set(CONFIG_KEY, config);
    console.log("  - Saved to storage successfully");

    // Verify save
    const verify = await storage.get(CONFIG_KEY);
    console.log(
      "  - Verification read:",
      JSON.stringify(verify[SETTINGS_KEY], null, 2)
    );

    return { success: true, settings };
  } catch (error) {
    console.error("❌ [configManager] setSettings error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get default settings
 */
function getDefaultSettings() {
  return {
    noHumanCommentThreshold: 96,
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
    // 🆕 AUTO-ACTIONS SETTINGS
    autoActions: {
      enabled: false, // Disabled by default - user must enable
      autoPingAssignee: true,
      autoPingThresholdHours: 72, // 3 days
      autoAddStalledLabel: true,
      autoReassignInactive: false, // Conservative - requires manual enable
      autoMoveStatus: false, // Conservative - requires manual enable
      autoEscalateCritical: false, // Conservative - requires manual enable
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
    console.error("❌ [configManager] exportConfig error:", error);
    return null;
  }
}

/**
 * Import configuration from JSON
 */
export async function importConfig(configJson) {
  try {
    await storage.set(CONFIG_KEY, configJson);
    console.log("✅ [configManager] Configuration imported successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ [configManager] importConfig error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all available statuses from Jira project
 */
export async function getAvailableStatuses(projectKey) {
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
