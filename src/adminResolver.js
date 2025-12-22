// src/adminResolver.js
import Resolver from "@forge/resolver";
import {
  getThresholds,
  setThresholds,
  resetThresholds,
  getSettings,
  setSettings,
} from "./configManager";
import { getDashboardMetrics } from "./dashboardMetrics";
import { testWebhook } from "./slackIntegration";

const resolver = new Resolver();

// Get initial configuration
resolver.define("getConfig", async () => {
  console.log("🔍 [adminResolver] getConfig called");

  try {
    const thresholds = await getThresholds();
    const settings = await getSettings();

    console.log("✅ [adminResolver] getConfig success");

    return { thresholds, settings };
  } catch (error) {
    console.error("❌ [adminResolver] getConfig error:", error);
    throw error;
  }
});

// Get dashboard metrics
resolver.define("getDashboard", async () => {
  console.log("📊 [adminResolver] getDashboard called");

  try {
    const metrics = await getDashboardMetrics();

    console.log("✅ [adminResolver] getDashboard success");

    return metrics;
  } catch (error) {
    console.error("❌ [adminResolver] getDashboard error:", error);
    throw error;
  }
});

// Save thresholds
resolver.define("saveThresholds", async ({ payload }) => {
  console.log("💾 [adminResolver] saveThresholds called");

  try {
    const result = await setThresholds(payload.thresholds);

    console.log("✅ [adminResolver] saveThresholds success");

    return result;
  } catch (error) {
    console.error("❌ [adminResolver] saveThresholds error:", error);
    return { success: false, error: error.message };
  }
});

// Reset thresholds to defaults
resolver.define("resetThresholds", async () => {
  console.log("🔄 [adminResolver] resetThresholds called");

  try {
    const result = await resetThresholds();

    console.log("✅ [adminResolver] resetThresholds success");

    return result;
  } catch (error) {
    console.error("❌ [adminResolver] resetThresholds error:", error);
    return { success: false, error: error.message };
  }
});

// Save general settings
resolver.define("saveSettings", async ({ payload }) => {
  console.log("💾 [adminResolver] saveSettings called");

  try {
    const result = await setSettings(payload.settings);

    console.log("✅ [adminResolver] saveSettings success");

    return result;
  } catch (error) {
    console.error("❌ [adminResolver] saveSettings error:", error);
    return { success: false, error: error.message };
  }
});

// 🆕 Test webhook connectivity
resolver.define("testWebhook", async ({ payload }) => {
  console.log("🧪 [adminResolver] testWebhook called");
  console.log("  - Platform:", payload.platform);

  try {
    const result = await testWebhook(payload.webhookUrl, payload.platform);

    console.log("✅ [adminResolver] testWebhook result:", result);

    return result;
  } catch (error) {
    console.error("❌ [adminResolver] testWebhook error:", error);
    return { success: false, error: error.message };
  }
});

// Debug: Get raw storage data
resolver.define("debugStorage", async () => {
  const { storage } = require("@forge/api");
  const data = await storage.get("pit-stop-config");
  console.log("Raw storage:", JSON.stringify(data, null, 2));
  return data;
});

export const handler = resolver.getDefinitions();
