export type ChecklistDebugLevel = "info" | "error";

export interface ChecklistDebugEvent {
  at: string;
  level: ChecklistDebugLevel;
  step: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ChecklistDiagnostics {
  readonly events: ChecklistDebugEvent[];
  getCurrentStep: () => string;
  info: (step: string, message: string, data?: Record<string, unknown>) => void;
  error: (step: string, message: string, data?: Record<string, unknown>) => void;
}

function safeData(data?: Record<string, unknown>) {
  if (!data) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && value.length > 800) out[key] = `${value.slice(0, 800)}…`;
    else out[key] = value;
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