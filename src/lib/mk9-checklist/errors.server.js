// Utilitário SERVER-ONLY para transformar qualquer exceção do fluxo de importação
// de checklist em uma mensagem estruturada (JSON string) que sobrevive à
// serialização RPC do TanStack e pode ser renderizada em detalhe no cliente.
import { ZodError } from "zod";
function firstStackFrame(stack) {
    if (!stack)
        return {};
    const lines = stack.split("\n").slice(1);
    for (const l of lines) {
        const m = l.match(/\(?([^\s()]+):(\d+):(\d+)\)?$/);
        if (m)
            return { file: m[1], line: Number(m[2]) };
    }
    return {};
}
function fromZod(err) {
    const issues = err.issues.map((i) => ({
        path: i.path.join("."),
        code: i.code,
        message: i.message,
        ...("expected" in i ? { expected: i.expected } : {}),
        ...("received" in i ? { received: i.received } : {}),
    }));
    const first = issues[0];
    return {
        field: first?.path || "(root)",
        expected: first?.expected,
        received: first?.received,
        issues,
    };
}
function fromPostgrest(err) {
    if (!err)
        return undefined;
    const keys = ["code", "message", "details", "hint"];
    const hasAny = keys.some((k) => err[k] != null);
    if (!hasAny)
        return undefined;
    const details = String(err.details ?? "");
    const constraint = /constraint "([^"]+)"/i.exec(details)?.[1] ?? /"([^"]+)"/.exec(details)?.[1];
    const column = /column "([^"]+)"/i.exec(err.message ?? "")?.[1];
    const table = /relation "([^"]+)"/i.exec(err.message ?? "")?.[1];
    const value = /Key \(([^)]+)\)=\(([^)]+)\)/.exec(details)?.[2];
    return {
        code: err.code,
        message: err.message,
        details: err.details,
        hint: err.hint,
        constraint,
        column,
        table,
        value,
    };
}
export function buildRichError(err, ctx) {
    const base = {
        __mk9Error: true,
        step: ctx.step,
        function: ctx.function,
        message: "Erro desconhecido",
    };
    if (ctx.parser)
        base.parser = ctx.parser;
    if (ctx.extra)
        base.extra = ctx.extra;
    if (err instanceof ZodError) {
        base.name = "ZodError";
        base.message = `Validação falhou: ${err.issues[0]?.path.join(".") || "input"} — ${err.issues[0]?.message}`;
        base.validation = fromZod(err);
        return base;
    }
    if (err instanceof Error) {
        base.name = err.name;
        base.message = err.message || err.name;
        base.stack = err.stack;
        Object.assign(base, firstStackFrame(err.stack));
        const db = fromPostgrest(err) ?? fromPostgrest(err.cause);
        if (db)
            base.database = db;
        return base;
    }
    if (err && typeof err === "object") {
        const db = fromPostgrest(err);
        if (db) {
            base.name = "DatabaseError";
            base.message = db.message ?? "Erro no banco";
            base.database = db;
            return base;
        }
        try {
            base.message = JSON.stringify(err);
        }
        catch {
            base.message = String(err);
        }
        return base;
    }
    base.message = String(err);
    return base;
}
/** Envolve `fn` e converte qualquer throw em `Error` com mensagem = JSON estruturado. */
export async function withRichErrors(ctx, fn) {
    try {
        return await fn();
    }
    catch (err) {
        const payload = buildRichError(err, ctx);
        // console.error preserva stack no worker log
        console.error(`[mk9-checklist:${ctx.step}]`, err);
        const wrapped = new Error(JSON.stringify(payload));
        wrapped.name = payload.name ?? "Mk9ChecklistError";
        throw wrapped;
    }
}
