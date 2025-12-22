import { storage } from "@forge/api";

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

export async function getThresholds() {
  console.log("📖 [configManager] getThresholds called");

  try {
    const config = await storage.get(CONFIG_KEY);

    if (!config || !config[THRESHOLDS_KEY]) {
      console.log("  - No custom thresholds, using defaults");
      return DEFAULT_THRESHOLDS;
    }

    return config[THRESHOLDS_KEY];
  } catch (error) {
    console.error("❌ [configManager] getThresholds error:", error);
    return DEFAULT_THRESHOLDS;
  }
}

export async function getThresholdForStatus(status) {
  const thresholds = await getThresholds();
  return thresholds[status] || thresholds["default"] || 72;
}

export async function setThresholds(thresholds) {
  console.log("💾 [configManager] setThresholds called");

  try {
    const config = (await storage.get(CONFIG_KEY)) || {};
    config[THRESHOLDS_KEY] = thresholds;
    await storage.set(CONFIG_KEY, config);

    return { success: true, thresholds };
  } catch (error) {
    console.error("❌ [configManager] setThresholds error:", error);
    return { success: false, error: error.message };
  }
}

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

export async function getSettings() {
  console.log("📖 [configManager] getSettings called");

  try {
    const config = await storage.get(CONFIG_KEY);

    if (!config || !config[SETTINGS_KEY]) {
      console.log("  - No custom settings, using defaults");
      return getDefaultSettings();
    }

    return config[SETTINGS_KEY];
  } catch (error) {
    console.error("❌ [configManager] getSettings error:", error);
    return getDefaultSettings();
  }
}

export async function setSettings(settings) {
  console.log("💾 [configManager] setSettings called");

  try {
    const config = (await storage.get(CONFIG_KEY)) || {};
    config[SETTINGS_KEY] = settings;
    await storage.set(CONFIG_KEY, config);

    return { success: true, settings };
  } catch (error) {
    console.error("❌ [configManager] setSettings error:", error);
    return { success: false, error: error.message };
  }
}

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
    autoActions: {
      enabled: false,
      autoPingAssignee: true,
      autoPingThresholdHours: 72,
      autoAddStalledLabel: true,
      autoReassignInactive: false,
      autoMoveStatus: false,
      autoEscalateCritical: false,
    },
    // 🆕 INTEGRATIONS SETTINGS
    integrations: {
      enabled: false, // Disabled by default
      jiraBaseUrl: "", // e.g., "https://your-domain.atlassian.net"
      slackWebhook: "", // Incoming webhook URL
      teamsWebhook: "", // Incoming webhook URL
      sendDailyDigest: true, // Send daily summary
      sendCriticalAlerts: true, // Send instant alerts for critical issues
      digestTime: "09:00", // Time to send daily digest (HH:MM)
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
