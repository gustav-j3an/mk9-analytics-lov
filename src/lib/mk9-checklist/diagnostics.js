function toDebugValue(value) {
    if (value === null)
        return null;
    if (typeof value === "string")
        return value.length > 800 ? `${value.slice(0, 800)}…` : value;
    if (typeof value === "number" || typeof value === "boolean")
        return value;
    if (Array.isArray(value))
        return value.map(toDebugValue);
    if (value instanceof Date)
        return value.toISOString();
    if (value && typeof value === "object") {
        const out = {};
        for (const [key, nested] of Object.entries(value))
            out[key] = toDebugValue(nested);
        return out;
    }
    if (value === undefined)
        return null;
    return String(value);
}
function safeData(data) {
    if (!data)
        return undefined;
    const out = {};
    for (const [key, value] of Object.entries(data)) {
        out[key] = toDebugValue(value);
    }
    return out;
}
export function createChecklistDiagnostics(scope) {
    const events = [];
    let currentStep = "init";
    const push = (level, step, message, data) => {
        currentStep = step;
        const event = {
            at: new Date().toISOString(),
            level,
            step,
            message,
            data: safeData(data),
        };
        events.push(event);
        const log = level === "error" ? console.error : console.log;
        log(`[mk9-checklist:${scope}:${step}] ${message}`, event.data ?? {});
    };
    return {
        events,
        getCurrentStep: () => currentStep,
        info: (step, message, data) => push("info", step, message, data),
        error: (step, message, data) => push("error", step, message, data),
    };
}
