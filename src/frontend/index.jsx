// src/frontend/index.jsx
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
  Tabs,
  TabList,
  Tab,
  TabPanel,
  ProgressBar,
} from "@forge/react";
import { invoke } from "@forge/bridge";

const App = () => {
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholdsState] = useState({});
  const [settings, setSettingsState] = useState(null);
  const [alert, setAlert] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // Dashboard state
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);

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

    window.testInvoke = invoke;
    console.log("✅ Debug helper loaded");
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

  const loadDashboard = async () => {
    setDashboardLoading(true);
    try {
      console.log("Loading dashboard metrics...");
      const metrics = await invoke("getDashboard");
      console.log("Dashboard loaded:", metrics);
      setDashboardMetrics(metrics);
      setDashboardLoading(false);
    } catch (error) {
      console.error("Dashboard load error:", error);
      setAlert({
        type: "error",
        message: "Failed to load dashboard: " + error.message,
      });
      setDashboardLoading(false);
    }
  };

  const onSaveThresholds = async (data) => {
    console.log("Saving thresholds:", data);
    setAlert({ type: "info", message: "Saving..." });

    const newThresholds = {};
    Object.keys(thresholds).forEach((key) => {
      const formValue = data[key];
      const hours = parseInt(formValue);

      if (!isNaN(hours) && hours > 0) {
        newThresholds[key] = hours;
      } else {
        newThresholds[key] = thresholds[key];
      }
    });

    console.log("Processed thresholds:", newThresholds);

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

  const handleTabChange = (index) => {
    setActiveTab(index);
    // Load dashboard when switching to dashboard tab
    if (index === 0 && !dashboardMetrics) {
      loadDashboard();
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
          Monitor stalled issues and configure detection thresholds for your
          team.
        </Text>
      </Box>

      {/* Status Messages */}
      {alert && (
        <Box padding="space.200">
          <SectionMessage title={alert.message} appearance={alert.type} />
        </Box>
      )}

      {/* Tabs */}
      <Tabs onChange={handleTabChange} id="pit-stop-tabs">
        <TabList>
          <Tab>📊 Dashboard</Tab>
          <Tab>⏱️ Thresholds</Tab>
          <Tab>⚙️ Settings</Tab>
        </TabList>

        {/* Dashboard Tab */}
        <TabPanel>
          <Stack space="space.300">
            <Box padding="space.300">
              <Stack space="space.200">
                <Box>
                  <Heading size="medium">Team Stall Dashboard</Heading>
                  <Text>
                    Real-time insights into bottlenecks and stalled work
                  </Text>
                </Box>

                <Button
                  appearance="primary"
                  onClick={loadDashboard}
                  isDisabled={dashboardLoading}
                >
                  {dashboardLoading ? "Loading..." : "🔄 Refresh Dashboard"}
                </Button>
              </Stack>
            </Box>

            {dashboardLoading && (
              <Box padding="space.300">
                <Text>Analyzing issues... This may take a moment.</Text>
                <ProgressBar />
              </Box>
            )}

            {dashboardMetrics && !dashboardLoading && (
              <Stack space="space.300">
                {/* Overview Cards */}
                <Box padding="space.300">
                  <Heading size="small">📈 Overview</Heading>
                  <Stack space="space.200">
                    <Text>Total Issues: {dashboardMetrics.totalIssues}</Text>
                    <Text>
                      🚨 Stalled Issues: {dashboardMetrics.stalledIssues} (
                      {dashboardMetrics.totalIssues > 0
                        ? Math.round(
                            (dashboardMetrics.stalledIssues /
                              dashboardMetrics.totalIssues) *
                              100
                          )
                        : 0}
                      %)
                    </Text>
                    <Text>
                      ✅ Healthy Issues: {dashboardMetrics.healthyIssues}
                    </Text>
                    <Text>
                      ⏱️ Average Stall Time: {dashboardMetrics.averageStallTime}{" "}
                      hours (
                      {(dashboardMetrics.averageStallTime / 24).toFixed(1)}{" "}
                      days)
                    </Text>
                  </Stack>
                </Box>

                {/* Severity Breakdown */}
                <Box padding="space.300">
                  <Heading size="small">⚠️ By Severity</Heading>
                  <Stack space="space.100">
                    <Text>
                      🚨 Critical: {dashboardMetrics.bySeverity.CRITICAL}
                    </Text>
                    <Text>⚠️ High: {dashboardMetrics.bySeverity.HIGH}</Text>
                    <Text>⏰ Medium: {dashboardMetrics.bySeverity.MEDIUM}</Text>
                    <Text>ℹ️ Low: {dashboardMetrics.bySeverity.LOW}</Text>
                  </Stack>
                </Box>

                {/* By Status */}
                <Box padding="space.300">
                  <Heading size="small">📊 Stalled by Status</Heading>
                  <Stack space="space.100">
                    {Object.entries(dashboardMetrics.byStatus)
                      .filter(([_, data]) => data.stalled > 0)
                      .sort((a, b) => b[1].stalled - a[1].stalled)
                      .map(([status, data]) => (
                        <Text key={status}>
                          {status}: {data.stalled} stalled / {data.total} total
                          ({Math.round((data.stalled / data.total) * 100)}%)
                        </Text>
                      ))}
                  </Stack>
                </Box>

                {/* By Assignee */}
                <Box padding="space.300">
                  <Heading size="small">👥 Stalled by Assignee</Heading>
                  <Stack space="space.100">
                    {Object.entries(dashboardMetrics.byAssignee)
                      .filter(([_, data]) => data.stalled > 0)
                      .sort((a, b) => b[1].stalled - a[1].stalled)
                      .slice(0, 10)
                      .map(([assignee, data]) => (
                        <Text key={assignee}>
                          {assignee}: {data.stalled} stalled / {data.total}{" "}
                          total
                        </Text>
                      ))}
                  </Stack>
                </Box>

                {/* Common Stall Reasons */}
                <Box padding="space.300">
                  <Heading size="small">🔍 Common Stall Reasons</Heading>
                  <Stack space="space.100">
                    {Object.entries(dashboardMetrics.stallReasons)
                      .sort((a, b) => b[1] - a[1])
                      .map(([reason, count]) => (
                        <Text key={reason}>
                          {reason.replace(/_/g, " ")}: {count} issues
                        </Text>
                      ))}
                  </Stack>
                </Box>

                {/* Longest Stalled */}
                {dashboardMetrics.longestStalled && (
                  <Box padding="space.300">
                    <Heading size="small">⏰ Longest Stalled Issue</Heading>
                    <SectionMessage appearance="warning">
                      <Stack space="space.100">
                        <Text>
                          Issue: {dashboardMetrics.longestStalled.key}
                        </Text>
                        <Text>
                          Status: {dashboardMetrics.longestStalled.status}
                        </Text>
                        <Text>
                          Stalled for:{" "}
                          {dashboardMetrics.longestStalled.hoursSinceUpdate}{" "}
                          hours (
                          {(
                            dashboardMetrics.longestStalled.hoursSinceUpdate /
                            24
                          ).toFixed(1)}{" "}
                          days)
                        </Text>
                        <Text>
                          Assignee: {dashboardMetrics.longestStalled.assignee}
                        </Text>
                        <Text>
                          Severity: {dashboardMetrics.longestStalled.severity}
                        </Text>
                      </Stack>
                    </SectionMessage>
                  </Box>
                )}

                {/* Recently Stalled */}
                {dashboardMetrics.recentlyStalled.length > 0 && (
                  <Box padding="space.300">
                    <Heading size="small">🆕 Recently Stalled Issues</Heading>
                    <Stack space="space.100">
                      {dashboardMetrics.recentlyStalled.map((issue) => (
                        <Text key={issue.key}>
                          {issue.key} - {issue.status} ({issue.hoursSinceUpdate}
                          h) - {issue.assignee}
                        </Text>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}

            {!dashboardMetrics && !dashboardLoading && (
              <Box padding="space.300">
                <SectionMessage appearance="info">
                  <Text>Click "Refresh Dashboard" to load metrics</Text>
                </SectionMessage>
              </Box>
            )}
          </Stack>
        </TabPanel>

        {/* Thresholds Tab */}
        <TabPanel>
          <Box padding="space.300">
            <Form onSubmit={handleThresholdsSubmit(onSaveThresholds)}>
              <FormHeader title="⏱️ Stall Thresholds (hours)">
                Configure how long an issue can remain in each status before
                being considered stalled.
              </FormHeader>
              <FormSection>
                <Stack space="space.200">
                  {Object.entries(thresholds).map(([status, hours]) => (
                    <Box key={status}>
                      <Label labelFor={getThresholdFieldId(status)}>
                        {status}
                      </Label>
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
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel>
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
                        defaultChecked={
                          settings.features?.postComments !== false
                        }
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

          {/* Pro Tips */}
          <Box padding="space.300">
            <SectionMessage title="💡 Pro Tips" appearance="info">
              <Text>
                • Lower thresholds = more aggressive stall detection{"\n"}•
                Higher thresholds = fewer false positives{"\n"}• Blocked issues
                should have short thresholds{"\n"}• Review statuses need quick
                attention{"\n"}• Enable Changelog Analysis for smarter detection
                {"\n"}• Enable Contextual Suggestions for actionable advice
              </Text>
            </SectionMessage>
          </Box>
        </TabPanel>
      </Tabs>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
