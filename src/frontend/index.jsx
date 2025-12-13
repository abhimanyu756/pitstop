import React, { useState, useEffect } from "react";
import ForgeReconciler, {
  Form,
  FormHeader,
  FormSection,
  FormFooter,
  Label,
  Textfield,
  Checkbox,
  Button,
  SectionMessage,
  Stack,
  Box,
  Heading,
  Text,
  useForm,
  invoke,
} from "@forge/react";

const App = () => {
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholdsState] = useState({});
  const [settings, setSettingsState] = useState(null);
  const [alert, setAlert] = useState(null);

  const {
    handleSubmit: handleThresholdsSubmit,
    register: registerThreshold,
    getFieldId: getThresholdFieldId,
  } = useForm();

  const {
    handleSubmit: handleSettingsSubmit,
    register: registerSetting,
    getFieldId: getSettingFieldId,
  } = useForm();

  useEffect(() => {
    console.log("Loading configuration...");
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      console.log("Invoking getConfig...");
      const config = await invoke("getConfig");
      console.log("Config loaded:", config);
      setThresholdsState(config.thresholds || {});
      setSettingsState(config.settings || {});
      setLoading(false);
    } catch (error) {
      console.error("Load error:", error);
      setAlert({
        type: "error",
        message: "Failed to load configuration: " + error.message,
      });
      setLoading(false);
    }
  };

  const onSaveThresholds = async (data) => {
    console.log("Saving thresholds:", data);
    setAlert({ type: "info", message: "Saving..." });

    const newThresholds = {};
    Object.keys(data).forEach((key) => {
      const hours = parseInt(data[key]);
      if (!isNaN(hours) && hours > 0) {
        newThresholds[key] = hours;
      }
    });

    try {
      const result = await invoke("saveThresholds", {
        thresholds: newThresholds,
      });

      if (result.success) {
        setThresholdsState(newThresholds);
        setAlert({
          type: "success",
          message: "✅ Thresholds saved successfully!",
        });
        setTimeout(() => setAlert(null), 3000);
      } else {
        setAlert({ type: "error", message: `❌ Error: ${result.error}` });
      }
    } catch (error) {
      console.error("Save error:", error);
      setAlert({
        type: "error",
        message: "Failed to save thresholds: " + error.message,
      });
    }
  };

  const handleResetThresholds = async () => {
    try {
      const result = await invoke("resetThresholds");
      if (result.success) {
        setThresholdsState(result.thresholds);
        setAlert({ type: "success", message: "✅ Reset to defaults!" });
        setTimeout(() => setAlert(null), 3000);
      }
    } catch (error) {
      console.error("Reset error:", error);
      setAlert({ type: "error", message: "Failed to reset thresholds" });
    }
  };

  const onSaveSettings = async (data) => {
    console.log("Saving settings:", data);
    setAlert({ type: "info", message: "Saving settings..." });

    const newSettings = {
      ...settings,
      noHumanCommentThreshold: parseInt(data.noHumanCommentThreshold) || 96,
      commentCooldownHours: parseInt(data.commentCooldownHours) || 24,
      maxIssuesPerRun: parseInt(data.maxIssuesPerRun) || 50,
      features: {
        detectNoActivity: data.detectNoActivity === "true",
        detectNoHumanComments: data.detectNoHumanComments === "true",
        detectUnassigned: data.detectUnassigned === "true",
        detectBlockers: data.detectBlockers === "true",
        postComments: data.postComments === "true",
        postEncouragement: data.postEncouragement === "true",
        useChangelogAnalysis: data.useChangelogAnalysis === "true",
        useContextualSuggestions: data.useContextualSuggestions === "true",
      },
    };

    try {
      const result = await invoke("saveSettings", { settings: newSettings });
      if (result.success) {
        setSettingsState(newSettings);
        setAlert({
          type: "success",
          message: "✅ Settings saved successfully!",
        });
        setTimeout(() => setAlert(null), 3000);
      } else {
        setAlert({ type: "error", message: `❌ Error: ${result.error}` });
      }
    } catch (error) {
      console.error("Save settings error:", error);
      setAlert({
        type: "error",
        message: "Failed to save settings: " + error.message,
      });
    }
  };

  if (loading) {
    return (
      <Box padding="space.400">
        <Text>Loading configuration...</Text>
      </Box>
    );
  }

  if (!settings) {
    return (
      <Box padding="space.400">
        <SectionMessage title="Error loading configuration" appearance="error">
          <Text>Please refresh the page or contact support.</Text>
        </SectionMessage>
      </Box>
    );
  }

  return (
    <Stack space="space.300">
      {/* Header */}
      <Box padding="space.300">
        <Heading size="large">🏎️ Pit Stop Configuration</Heading>
        <Text>
          Configure stall detection thresholds and features for your team.
        </Text>
      </Box>

      {/* Status Messages */}
      {alert && (
        <Box padding="space.200">
          <SectionMessage title={alert.message} appearance={alert.type} />
        </Box>
      )}

      {/* Threshold Configuration */}
      <Box padding="space.300">
        <Form onSubmit={handleThresholdsSubmit(onSaveThresholds)}>
          <FormHeader title="⏱️ Stall Thresholds (hours)">
            Configure how long an issue can remain in each status before being
            considered stalled.
          </FormHeader>
          <FormSection>
            <Stack space="space.200">
              {Object.entries(thresholds).map(([status, hours]) => (
                <Box key={status}>
                  <Label labelFor={getThresholdFieldId(status)}>{status}</Label>
                  <Textfield
                    {...registerThreshold(status)}
                    type="number"
                    defaultValue={String(hours)}
                  />
                  <Text>({(hours / 24).toFixed(1)} days)</Text>
                </Box>
              ))}
            </Stack>
          </FormSection>
          <FormFooter>
            <Button appearance="primary" type="submit">
              Save Thresholds
            </Button>
            <Button appearance="subtle" onClick={handleResetThresholds}>
              Reset to Defaults
            </Button>
          </FormFooter>
        </Form>
      </Box>

      {/* General Settings */}
      {settings && (
        <Box padding="space.300">
          <Form onSubmit={handleSettingsSubmit(onSaveSettings)}>
            <FormHeader title="⚙️ General Settings" />
            <FormSection>
              <Stack space="space.200">
                <Box>
                  <Label
                    labelFor={getSettingFieldId("noHumanCommentThreshold")}
                  >
                    No Human Comment Threshold (hours)
                  </Label>
                  <Textfield
                    {...registerSetting("noHumanCommentThreshold")}
                    type="number"
                    defaultValue={String(
                      settings.noHumanCommentThreshold || 96
                    )}
                  />
                  <Text>
                    Flag issues without human comments for this many hours
                  </Text>
                </Box>

                <Box>
                  <Label labelFor={getSettingFieldId("commentCooldownHours")}>
                    Comment Cooldown (hours)
                  </Label>
                  <Textfield
                    {...registerSetting("commentCooldownHours")}
                    type="number"
                    defaultValue={String(settings.commentCooldownHours || 24)}
                  />
                  <Text>Minimum time between bot comments on same issue</Text>
                </Box>

                <Box>
                  <Label labelFor={getSettingFieldId("maxIssuesPerRun")}>
                    Max Issues Per Scan
                  </Label>
                  <Textfield
                    {...registerSetting("maxIssuesPerRun")}
                    type="number"
                    defaultValue={String(settings.maxIssuesPerRun || 50)}
                  />
                  <Text>Maximum issues to scan per scheduled run</Text>
                </Box>

                <Box>
                  <Label>Features</Label>
                  <Stack space="space.100">
                    <Checkbox
                      {...registerSetting("detectNoActivity")}
                      label="Detect No Activity"
                      defaultChecked={
                        settings.features?.detectNoActivity !== false
                      }
                      value="true"
                    />
                    <Checkbox
                      {...registerSetting("detectNoHumanComments")}
                      label="Detect No Human Comments"
                      defaultChecked={
                        settings.features?.detectNoHumanComments !== false
                      }
                      value="true"
                    />
                    <Checkbox
                      {...registerSetting("detectUnassigned")}
                      label="Detect Unassigned Issues"
                      defaultChecked={
                        settings.features?.detectUnassigned !== false
                      }
                      value="true"
                    />
                    <Checkbox
                      {...registerSetting("detectBlockers")}
                      label="Detect Blockers"
                      defaultChecked={
                        settings.features?.detectBlockers !== false
                      }
                      value="true"
                    />
                    <Checkbox
                      {...registerSetting("postComments")}
                      label="Post Comments"
                      defaultChecked={settings.features?.postComments !== false}
                      value="true"
                    />
                    <Checkbox
                      {...registerSetting("postEncouragement")}
                      label="Post Encouragement (when healthy)"
                      defaultChecked={
                        settings.features?.postEncouragement === true
                      }
                      value="true"
                    />
                    <Checkbox
                      {...registerSetting("useChangelogAnalysis")}
                      label="Use Changelog Analysis 🆕"
                      defaultChecked={
                        settings.features?.useChangelogAnalysis !== false
                      }
                      value="true"
                    />
                    <Checkbox
                      {...registerSetting("useContextualSuggestions")}
                      label="Use Contextual Suggestions 🆕"
                      defaultChecked={
                        settings.features?.useContextualSuggestions !== false
                      }
                      value="true"
                    />
                  </Stack>
                </Box>
              </Stack>
            </FormSection>
            <FormFooter>
              <Button appearance="primary" type="submit">
                Save Settings
              </Button>
            </FormFooter>
          </Form>
        </Box>
      )}

      {/* Pro Tips */}
      <Box padding="space.300">
        <SectionMessage title="💡 Pro Tips" appearance="info">
          <Text>
            • Lower thresholds = more aggressive stall detection{"\n"}• Higher
            thresholds = fewer false positives{"\n"}• Blocked issues should have
            short thresholds{"\n"}• Review statuses need quick attention{"\n"}•
            Enable Changelog Analysis for smarter detection{"\n"}• Enable
            Contextual Suggestions for actionable advice
          </Text>
        </SectionMessage>
      </Box>
    </Stack>
  );
};

ForgeReconciler.render(<App />);
