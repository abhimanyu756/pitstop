export const isStalled = async (issue) => {
    const now = new Date();
    const updated = new Date(issue.fields.updated);
    const status = issue.fields.status.name;
    const timeSinceUpdate = (now - updated) / (1000 * 60 * 60); // Hours

    // Configurable thresholds (could be moved to a settings object)
    const THRESHOLDS = {
        'In Progress': 48, // 48 hours
        'In Review': 24,   // 24 hours
        'To Do': 168       // 1 week
    };

    if (THRESHOLDS[status] && timeSinceUpdate > THRESHOLDS[status]) {
        // It's technically "stalled" based on time, but let's check for "Silent Stalls"
        // We want to ensure the last update wasn't just a bot or a system field change
        // For this MVP, we'll trust the 'updated' field but in V2 we'd parse the changelog

        return {
            isStalled: true,
            reason: `No activity in '${status}' for ${Math.floor(timeSinceUpdate)} hours.`
        };
    }

    return { isStalled: false };
};

export const getStallReason = (issue) => {
    // Helper to generate a human-readable reason
    // This could be expanded to analyze comments using the Rovo Agent's AI capabilities
    return "Unknown";
};
