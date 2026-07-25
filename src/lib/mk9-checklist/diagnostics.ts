export type ChecklistDebugLevel = "info" | "error";
type ChecklistDebugValue = string | number | boolean | null | ChecklistDebugValue[] | { [key: string]: ChecklistDebugValue };

export interface ChecklistDebugEvent {
  at: string;
  level: ChecklistDebugLevel;
  step: string;
  message: string;
  data?: Record<string, ChecklistDebugValue>;
}

export interface ChecklistDiagnostics {
  readonly events: ChecklistDebugEvent[];
  getCurrentStep: () => string;
  info: (step: string, message: string, data?: Record<string, unknown>) => void;
  error: (step: string, message: string, data?: Record<string, unknown>) => void;
}

function toDebugValue(value: unknown): ChecklistDebugValue {
  if (value === null) return null;
  if (typeof value === "string") return value.length > 800 ? `${value.slice(0, 800)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(toDebugValue);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const out: { [key: string]: ChecklistDebugValue } = {};
    for (const [key, nested] of Object.entries(value)) out[key] = toDebugValue(nested);
    return out;
  }
  if (value === undefined) return null;
  return String(value);
}

function safeData(data?: Record<string, unknown>): Record<string, ChecklistDebugValue> | undefined {
  if (!data) return undefined;
  const out: Record<string, ChecklistDebugValue> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = toDebugValue(value);
  }
  return out;
}

export function createChecklistDiagnostics(scope: string): ChecklistDiagnostics {
  const events: ChecklistDebugEvent[] = [];
  let currentStep = "init";

  const push = (level: ChecklistDebugLevel, step: string, message: string, data?: Record<string, unknown>) => {
    currentStep = step;
    const event: ChecklistDebugEvent = {
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