/**
 * Feature 2.3: Admin UI Panel
 * Forge UI for configuring Pit Stop settings
 */

import ForgeUI, {
  render,
  Fragment,
  AdminPage,
  Form,
  TextField,
  CheckboxGroup,
  Checkbox,
  Button,
  Text,
  SectionMessage,
  Table,
  Head,
  Row,
  Cell,
  useProductContext,
  useState,
  useEffect,
} from "@forge/ui";

import {
  getThresholds,
  setThresholds,
  resetThresholds,
  getSettings,
  setSettings,
  exportConfig,
} from "./configManager";

const AdminPanel = () => {
  const [thresholds, setThresholdsState] = useState(null);
  const [settings, setSettingsState] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load config on mount
  useEffect(async () => {
    const loadedThresholds = await getThresholds();
    const loadedSettings = await getSettings();
    setThresholdsState(loadedThresholds);
    setSettingsState(loadedSettings);
    setLoading(false);
  }, []);

  const handleSaveThresholds = async (formData) => {
    setSaveStatus({ type: "info", message: "Saving..." });

    const newThresholds = {};
    Object.keys(formData).forEach((key) => {
      const hours = parseInt(formData[key]);
      if (!isNaN(hours) && hours > 0) {
        newThresholds[key] = hours;
      }
    });

    const result = await setThresholds(newThresholds);

    if (result.success) {
      setThresholdsState(newThresholds);
      setSaveStatus({
        type: "success",
        message: "✅ Thresholds saved successfully!",
      });
    } else {
      setSaveStatus({
        type: "error",
        message: `❌ Error: ${result.error}`,
      });
    }

    // Clear status after 3 seconds
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleResetThresholds = async () => {
    const result = await resetThresholds();
    if (result.success) {
      setThresholdsState(result.thresholds);
      setSaveStatus({
        type: "success",
        message: "✅ Reset to defaults!",
      });
    }
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSaveSettings = async (formData) => {
    setSaveStatus({ type: "info", message: "Saving settings..." });

    const newSettings = {
      ...settings,
      noHumanCommentThreshold: parseInt(formData.noHumanCommentThreshold) || 96,
      commentCooldownHours: parseInt(formData.commentCooldownHours) || 24,
      maxIssuesPerRun: parseInt(formData.maxIssuesPerRun) || 50,
      features: {
        ...settings.features,
        detectNoActivity: formData.features?.includes("detectNoActivity"),
        detectNoHumanComments: formData.features?.includes(
          "detectNoHumanComments"
        ),
        detectUnassigned: formData.features?.includes("detectUnassigned"),
        detectBlockers: formData.features?.includes("detectBlockers"),
        postComments: formData.features?.includes("postComments"),
        postEncouragement: formData.features?.includes("postEncouragement"),
        useChangelogAnalysis: formData.features?.includes(
          "useChangelogAnalysis"
        ),
        useContextualSuggestions: formData.features?.includes(
          "useContextualSuggestions"
        ),
      },
    };

    const result = await setSettings(newSettings);

    if (result.success) {
      setSettingsState(newSettings);
      setSaveStatus({
        type: "success",
        message: "✅ Settings saved successfully!",
      });
    } else {
      setSaveStatus({
        type: "error",
        message: `❌ Error: ${result.error}`,
      });
    }

    setTimeout(() => setSaveStatus(null), 3000);
  };

  if (loading) {
    return (
      <AdminPage>
        <Text>Loading configuration...</Text>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <Fragment>
        {/* Header */}
        <Text>
          <Text content="# 🏎️ Pit Stop Configuration" />
        </Text>
        <Text>
          Configure stall detection thresholds and features for your team.
        </Text>

        {/* Status Messages */}
        {saveStatus && (
          <SectionMessage
            title={saveStatus.message}
            appearance={saveStatus.type}
          />
        )}

        {/* Threshold Configuration */}
        <Text>
          <Text content="## ⏱️ Stall Thresholds (hours)" />
        </Text>
        <Text>
          Configure how long an issue can remain in each status before being
          considered stalled.
        </Text>

        <Form onSubmit={handleSaveThresholds}>
          <TextField
            label="In Progress"
            name="In Progress"
            defaultValue={String(thresholds["In Progress"])}
            description="Hours before 'In Progress' issues are flagged"
          />
          <TextField
            label="In Review"
            name="In Review"
            defaultValue={String(thresholds["In Review"])}
            description="Hours before code reviews are flagged"
          />
          <TextField
            label="Code Review"
            name="Code Review"
            defaultValue={String(thresholds["Code Review"])}
            description="Hours before code reviews are flagged"
          />
          <TextField
            label="To Do"
            name="To Do"
            defaultValue={String(thresholds["To Do"])}
            description="Hours before unstarted issues are flagged"
          />
          <TextField
            label="Blocked"
            name="Blocked"
            defaultValue={String(thresholds["Blocked"])}
            description="Hours before blocked issues are flagged (should be short)"
          />
          <TextField
            label="Testing/QA"
            name="Testing"
            defaultValue={String(thresholds["Testing"])}
            description="Hours before testing issues are flagged"
          />
          <TextField
            label="Default (Other Statuses)"
            name="default"
            defaultValue={String(thresholds["default"])}
            description="Default threshold for any other status"
          />
        </Form>

        <Button text="Reset to Defaults" onClick={handleResetThresholds} />

        {/* General Settings */}
        <Text>
          <Text content="## ⚙️ General Settings" />
        </Text>

        <Form onSubmit={handleSaveSettings}>
          <TextField
            label="No Human Comment Threshold (hours)"
            name="noHumanCommentThreshold"
            defaultValue={String(settings.noHumanCommentThreshold)}
            description="Flag issues without human comments for this many hours"
          />
          <TextField
            label="Comment Cooldown (hours)"
            name="commentCooldownHours"
            defaultValue={String(settings.commentCooldownHours)}
            description="Minimum time between bot comments on same issue"
          />
          <TextField
            label="Max Issues Per Scan"
            name="maxIssuesPerRun"
            defaultValue={String(settings.maxIssuesPerRun)}
            description="Maximum issues to scan per scheduled run"
          />

          <CheckboxGroup
            label="Features"
            name="features"
            description="Enable or disable detection features"
          >
            <Checkbox
              label="Detect No Activity"
              value="detectNoActivity"
              defaultChecked={settings.features.detectNoActivity}
            />
            <Checkbox
              label="Detect No Human Comments"
              value="detectNoHumanComments"
              defaultChecked={settings.features.detectNoHumanComments}
            />
            <Checkbox
              label="Detect Unassigned Issues"
              value="detectUnassigned"
              defaultChecked={settings.features.detectUnassigned}
            />
            <Checkbox
              label="Detect Blockers"
              value="detectBlockers"
              defaultChecked={settings.features.detectBlockers}
            />
            <Checkbox
              label="Post Comments"
              value="postComments"
              defaultChecked={settings.features.postComments}
            />
            <Checkbox
              label="Post Encouragement (when healthy)"
              value="postEncouragement"
              defaultChecked={settings.features.postEncouragement}
            />
            <Checkbox
              label="Use Changelog Analysis 🆕"
              value="useChangelogAnalysis"
              defaultChecked={settings.features.useChangelogAnalysis}
            />
            <Checkbox
              label="Use Contextual Suggestions 🆕"
              value="useContextualSuggestions"
              defaultChecked={settings.features.useContextualSuggestions}
            />
          </CheckboxGroup>
        </Form>

        {/* Current Configuration Display */}
        <Text>
          <Text content="## 📊 Current Configuration" />
        </Text>

        <Table>
          <Head>
            <Cell>
              <Text>Status</Text>
            </Cell>
            <Cell>
              <Text>Threshold (hours)</Text>
            </Cell>
            <Cell>
              <Text>Days</Text>
            </Cell>
          </Head>
          {Object.entries(thresholds).map(([status, hours]) => (
            <Row>
              <Cell>
                <Text>{status}</Text>
              </Cell>
              <Cell>
                <Text>{hours}</Text>
              </Cell>
              <Cell>
                <Text>{(hours / 24).toFixed(1)}</Text>
              </Cell>
            </Row>
          ))}
        </Table>

        {/* Help Text */}
        <SectionMessage title="💡 Pro Tips" appearance="info">
          <Text>
            • Lower thresholds = more aggressive stall detection{"\n"}• Higher
            thresholds = fewer false positives{"\n"}• Blocked issues should have
            short thresholds{"\n"}• Review statuses need quick attention{"\n"}•
            Enable Changelog Analysis for smarter detection{"\n"}• Enable
            Contextual Suggestions for actionable advice
          </Text>
        </SectionMessage>
      </Fragment>
    </AdminPage>
  );
};

export const run = render(<AdminPanel />);
