import Resolver from "@forge/resolver";
import {
  getThresholds,
  setThresholds,
  resetThresholds,
  getSettings,
  setSettings,
} from "./configManager";

const resolver = new Resolver();

// Get initial configuration
resolver.define("getConfig", async () => {
  console.log("🔍 [adminResolver] getConfig called");

  try {
    const thresholds = await getThresholds();
    const settings = await getSettings();

    console.log("✅ [adminResolver] getConfig success:");
    console.log("  - Thresholds:", JSON.stringify(thresholds, null, 2));
    console.log("  - Settings:", JSON.stringify(settings, null, 2));

    return { thresholds, settings };
  } catch (error) {
    console.error("❌ [adminResolver] getConfig error:", error);
    throw error;
  }
});

// Save thresholds
resolver.define("saveThresholds", async ({ payload }) => {
  console.log("💾 [adminResolver] saveThresholds called");
  console.log("  - Payload:", JSON.stringify(payload, null, 2));

  try {
    const result = await setThresholds(payload.thresholds);

    console.log(
      "✅ [adminResolver] saveThresholds result:",
      JSON.stringify(result, null, 2)
    );

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

    console.log(
      "✅ [adminResolver] resetThresholds result:",
      JSON.stringify(result, null, 2)
    );

    return result;
  } catch (error) {
    console.error("❌ [adminResolver] resetThresholds error:", error);
    return { success: false, error: error.message };
  }
});

// Save general settings
resolver.define("saveSettings", async ({ payload }) => {
  console.log("💾 [adminResolver] saveSettings called");
  console.log("  - Payload:", JSON.stringify(payload, null, 2));

  try {
    const result = await setSettings(payload.settings);

    console.log(
      "✅ [adminResolver] saveSettings result:",
      JSON.stringify(result, null, 2)
    );

    return result;
  } catch (error) {
    console.error("❌ [adminResolver] saveSettings error:", error);
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
