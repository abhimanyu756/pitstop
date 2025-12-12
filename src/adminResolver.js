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
  const thresholds = await getThresholds();
  const settings = await getSettings();
  return { thresholds, settings };
});

// Save thresholds
resolver.define("saveThresholds", async ({ payload }) => {
  const result = await setThresholds(payload.thresholds);
  return result;
});

// Reset thresholds to defaults
resolver.define("resetThresholds", async () => {
  const result = await resetThresholds();
  return result;
});

// Save general settings
resolver.define("saveSettings", async ({ payload }) => {
  const result = await setSettings(payload.settings);
  return result;
});

export const handler = resolver.getDefinitions();
