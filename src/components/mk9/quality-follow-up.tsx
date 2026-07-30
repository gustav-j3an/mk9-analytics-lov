/**
 * MK9 — Fase 2B.4: blocos de acompanhamento das ocorrências de qualidade.
 *
 * Responsabilidade, prazo, tratativa e comentários. A tela nunca decide
 * permissão sozinha: ela apenas evita oferecer o que o servidor recusaria.
 */
import { useMemo, useState } from "react";
import {
  CalendarClock,
  CircleAlert,
  Flag,
  Loader2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  RESOLUTION_LABEL,
  RESOLUTION_TYPES,
  canAssignOthers,
  canComment,
  canForceResolution,
  canIgnore,
  canPlan,
  canReopen,
  canSelfAssign,
  canUnassign,
  validateResolution,
  RESOLUTION_PROBLEM_MESSAGE,
  FORCE_MIN_JUSTIFICATION,
  type Mk9ResolutionType,
} from "@/lib/mk9-quality/assignment";
import {
  COMMENT_PROBLEM_MESSAGE,
  canEditComment,
  sanitizeCommentBody,
  type Mk9QualityCommentView,
} from "@/lib/mk9-quality/comments";
import {
  allowedTransitions,
  canReopenStatus,
  validateReason,
  validateReopenReason,
  type Mk9ManualTransition,
} from "@/lib/mk9-quality/lifecycle";
import {
  MK9_PRIORITIES,
  PRIORITY_META,
  SLA_LABEL,
  dueLabel,
  durationLabel,
  isOverdue,
  priorityLabel,
} from "@/lib/mk9-quality/sla";
import { dateTimeLabel, relativeLabel } from "@/lib/mk9-quality/labels";
import type {
  Mk9QualityAssignableUser,
  Mk9QualityFollowUpSummary,
  Mk9QualityIssueView,
} from "@/lib/mk9-quality/types";

const UNASSIGNED = "__UNASSIGNED__";

// ---------------------------------------------------------------------------
// Selos
// ---------------------------------------------------------------------------

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[(priority ?? "NORMAL") as keyof typeof PRIORITY_META];
  if (!meta || priority === "NORMAL") return null;
  return (
    <Badge variant="outline" className={cn("gap-1 text-[10px]", meta.className)}>
      <Flag className="h-3 w-3" /> {meta.label}
    </Badge>
  );
}

export function DueBadge({ issue }: { issue: Pick<Mk9QualityIssueView, "dueAt" | "status"> }) {
  if (!issue.dueAt) return null;
  const late = isOverdue(issue);
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px]",
        late
          ? "border-destructive/45 bg-destructive/12 text-destructive"
          : "border-border text-muted-foreground",
      )}
      title={dateTimeLabel(issue.dueAt)}
    >
      <CalendarClock className="h-3 w-3" /> {dueLabel(issue)}
    </Badge>
  );
}

export function AssigneeBadge({ name }: { name: string | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px]",
        name ? "text-muted-foreground" : "text-muted-foreground/70",
      )}
    >
      <UserRound className="h-3 w-3" />
      {name ?? "Sem responsável"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Painel de acompanhamento (topo da tela)
// ---------------------------------------------------------------------------

export function FollowUpPanel({
  summary,
  onFilter,
  activeFilter,
}: {
  summary: Mk9QualityFollowUpSummary;
  onFilter: (patch: { assignedTo?: string | null; dueState?: string | null }) => void;
  activeFilter: { assignedTo: string | null; dueState: string | null };
}) {
  const cards = [
    {
      key: "overdue",
      label: "Fora do prazo",
      value: summary.overdue,
      unit: "ocorrências vencidas",
      danger: true,
      apply: { dueState: "OVERDUE", assignedTo: null },
      active: activeFilter.dueState === "OVERDUE",
    },
    {
      key: "today",
      label: "Vencem hoje",
      value: summary.dueToday,
      unit: "ocorrências no limite",
      apply: { dueState: "DUE_TODAY", assignedTo: null },
      active: activeFilter.dueState === "DUE_TODAY",
    },
    {
      key: "mine",
      label: "Minhas ocorrências",
      value: summary.mine,
      unit: "atribuídas a você",
      apply: { assignedTo: "ME", dueState: null },
      active: activeFilter.assignedTo === "ME",
    },
    {
      key: "unassigned",
      label: "Sem responsável",
      value: summary.unassigned,
      unit: "aguardando alguém",
      apply: { assignedTo: "UNASSIGNED", dueState: null },
      active: activeFilter.assignedTo === "UNASSIGNED",
    },
    {
      key: "nodue",
      label: "Sem prazo",
      value: summary.withoutDueDate,
      unit: "ocorrências sem data",
      apply: { dueState: "NO_DUE_DATE", assignedTo: null },
      active: activeFilter.dueState === "NO_DUE_DATE",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Acompanhamento</p>
        <p className="text-[11px] text-muted-foreground">
          Reconhecimento em média: {durationLabel(summary.avgHoursToAcknowledge)} · Resolução em
          média: {durationLabel(summary.avgHoursToResolve)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <button
            key={card.key}
            onClick={() => onFilter(card.active ? { assignedTo: null, dueState: null } : card.apply)}
            className={cn(
              "card-hover rounded-xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-primary/40",
              card.danger && card.value > 0 && "border-destructive/30",
              card.active && "border-primary/60 bg-primary/5",
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{card.unit}</p>
          </button>
        ))}
      </div>

      {summary.workload.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Carga por responsável
          </p>
          <ul className="mt-2 space-y-1.5">
            {summary.workload.map((w) => (
              <li key={w.userId} className="flex items-center justify-between gap-3 text-sm">
                <button
                  className="truncate text-left hover:text-primary"
                  onClick={() => onFilter({ assignedTo: w.userId, dueState: null })}
                >
                  {w.name}
                </button>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {w.open} em aberto
                  {w.overdue > 0 && <span className="text-destructive"> · {w.overdue} vencida(s)</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Responsabilidade e prazo (dentro do detalhe)
// ---------------------------------------------------------------------------

export function AssignmentSection({
  issue,
  role,
  currentUserId,
  users,
  onAssign,
  onPlanning,
}: {
  issue: Mk9QualityIssueView;
  role: string;
  currentUserId: string | null;
  users: Mk9QualityAssignableUser[];
  onAssign: (assigneeId: string | null, note: string | null) => Promise<void>;
  onPlanning: (input: {
    priority?: string | null;
    dueAt?: string | null;
    clearDue?: boolean;
  }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [dueInput, setDueInput] = useState(
    issue.dueAt ? new Date(issue.dueAt).toISOString().slice(0, 10) : "",
  );

  const mayAssign = canAssignOthers(role);
  const maySelf = canSelfAssign(role);
  const mayPlan = canPlan(role);
  const isMine = !!currentUserId && issue.assignedToUserId === currentUserId;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setNote("");
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Responsabilidade e prazo</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={issue.priority} />
          <DueBadge issue={issue} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Responsável</p>
          {mayAssign ? (
            <Select
              value={issue.assignedToUserId ?? UNASSIGNED}
              disabled={busy}
              onValueChange={(v) => run(() => onAssign(v === UNASSIGNED ? null : v, note || null))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent>
                {canUnassign(role) && <SelectItem value={UNASSIGNED}>Sem responsável</SelectItem>}
                {users.map((u) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    {u.name} · {u.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm">{issue.assignedToName ?? "Sem responsável"}</p>
          )}
          {issue.assignedAt && (
            <p className="text-[11px] text-muted-foreground">
              Atribuída {relativeLabel(issue.assignedAt)}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Prioridade</p>
          {mayPlan ? (
            <Select
              value={issue.priority}
              disabled={busy}
              onValueChange={(v) => run(() => onPlanning({ priority: v }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MK9_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm">{priorityLabel(issue.priority)}</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Prazo padrão desta gravidade: {SLA_LABEL[issue.severity]}
          </p>
        </div>

        {mayPlan && (
          <div className="space-y-1 sm:col-span-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Prazo</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                className="h-9 w-[170px]"
                value={dueInput}
                disabled={busy}
                onChange={(e) => setDueInput(e.target.value)}
                aria-label="Data limite"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !dueInput}
                onClick={() =>
                  run(() =>
                    onPlanning({
                      dueAt: new Date(`${dueInput}T23:59:59`).toISOString(),
                    }),
                  )
                }
              >
                Salvar prazo
              </Button>
              {issue.dueAt && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setDueInput("");
                    return run(() => onPlanning({ clearDue: true }));
                  }}
                >
                  Remover prazo
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {(mayAssign || maySelf) && (
        <div className="flex flex-wrap items-center gap-2">
          {maySelf && !isMine && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run(() => onAssign("ME", note || null))}
            >
              Assumir para mim
            </Button>
          )}
          {mayAssign && (
            <Input
              className="h-9 flex-1 min-w-[180px]"
              placeholder="Observação da atribuição (opcional)"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </div>
      )}

      {issue.assignmentNote && (
        <p className="text-xs text-muted-foreground">“{issue.assignmentNote}”</p>
      )}
      {busy && <p className="text-[11px] text-muted-foreground">Salvando…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tratativa: transições, resolução estruturada e reabertura
// ---------------------------------------------------------------------------

const TRANSITION_LABEL: Record<Mk9ManualTransition, string> = {
  ACKNOWLEDGED: "Reconhecer",
  IN_PROGRESS: "Iniciar tratativa",
  RESOLVED: "Registrar resolução",
  IGNORED: "Ignorar",
};

export function TreatmentSection({
  issue,
  role,
  stillDetected,
  onTransition,
  onReopen,
}: {
  issue: Mk9QualityIssueView;
  role: string;
  /** A ocorrência continua sendo detectada na última execução? */
  stillDetected: boolean;
  onTransition: (input: {
    toStatus: Mk9ManualTransition;
    reason: string;
    resolutionType?: string | null;
    forced?: boolean;
    ignoreUntil?: string | null;
  }) => Promise<void>;
  onReopen: (reason: string) => Promise<void>;
}) {
  const [pending, setPending] = useState<Mk9ManualTransition | "REOPEN" | null>(null);
  const [reason, setReason] = useState("");
  const [resolutionType, setResolutionType] = useState<Mk9ResolutionType | "">("");
  const [forced, setForced] = useState(false);
  const [ignoreUntil, setIgnoreUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () =>
      allowedTransitions(issue.status).filter((t) => (t === "IGNORED" ? canIgnore(role) : true)),
    [issue.status, role],
  );
  const mayReopen = canReopen(role) && canReopenStatus(issue.status);
  const mayForce = canForceResolution(role);

  function reset() {
    setPending(null);
    setReason("");
    setResolutionType("");
    setForced(false);
    setIgnoreUntil("");
    setError(null);
  }

  async function confirm() {
    setError(null);

    if (pending === "REOPEN") {
      if (!validateReopenReason(reason)) {
        setError("Explique por que a ocorrência precisa voltar (mínimo de 10 caracteres).");
        return;
      }
      setBusy(true);
      try {
        await onReopen(reason.trim());
        reset();
      } catch (e) {
        setError(messageForError(e));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!pending) return;

    if (pending === "RESOLVED") {
      const problems = validateResolution({ resolutionType: resolutionType || null, note: reason });
      if (problems.length) {
        setError(RESOLUTION_PROBLEM_MESSAGE[problems[0]]);
        return;
      }
      if (stillDetected && !forced) {
        setError("O problema ainda é detectado. Marque a confirmação para registrar mesmo assim.");
        return;
      }
      if (forced && reason.trim().length < FORCE_MIN_JUSTIFICATION) {
        setError(
          `Para registrar com o problema ainda presente, detalhe o motivo (mínimo de ${FORCE_MIN_JUSTIFICATION} caracteres).`,
        );
        return;
      }
    } else if (!validateReason(pending, reason)) {
      setError(
        pending === "IGNORED"
          ? "Justificativa obrigatória para ignorar (mínimo de 5 caracteres)."
          : "Escreva uma nota curta sobre esta ação.",
      );
      return;
    }

    setBusy(true);
    try {
      await onTransition({
        toStatus: pending,
        reason: reason.trim(),
        resolutionType: pending === "RESOLVED" ? resolutionType || null : null,
        forced: pending === "RESOLVED" ? forced : false,
        ignoreUntil:
          pending === "IGNORED" && ignoreUntil
            ? new Date(`${ignoreUntil}T23:59:59`).toISOString()
            : null,
      });
      reset();
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!options.length && !mayReopen) {
    return (
      <section className="space-y-2">
        <Separator />
        <p className="text-sm font-semibold">Tratativa</p>
        <p className="text-xs text-muted-foreground">
          Esta ocorrência está encerrada. Se o problema voltar a ser detectado, ela reabre
          automaticamente.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <Separator />
      <p className="text-sm font-semibold">Tratativa</p>

      {issue.resolutionType && (
        <p className="text-xs text-muted-foreground">
          Resolução registrada: <strong>{RESOLUTION_LABEL[issue.resolutionType as Mk9ResolutionType] ?? issue.resolutionType}</strong>
          {issue.resolutionForced && " · registrada com o problema ainda presente"}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {options.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={t === "IGNORED" ? "destructive" : pending === t ? "default" : "outline"}
            onClick={() => (pending === t ? reset() : (reset(), setPending(t)))}
          >
            {TRANSITION_LABEL[t]}
          </Button>
        ))}
        {mayReopen && (
          <Button
            size="sm"
            variant={pending === "REOPEN" ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => (pending === "REOPEN" ? reset() : (reset(), setPending("REOPEN")))}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reabrir
          </Button>
        )}
      </div>

      {pending && (
        <div className="space-y-3 rounded-lg border border-border/70 p-3">
          {pending === "RESOLVED" && (
            <>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Tipo de resolução
                </p>
                <Select
                  value={resolutionType}
                  onValueChange={(v) => setResolutionType(v as Mk9ResolutionType)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o que foi feito" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLUTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {RESOLUTION_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {stillDetected && (
                <div className="space-y-2 rounded-md border border-destructive/35 bg-destructive/8 p-2.5">
                  <p className="flex items-start gap-2 text-xs text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    O problema ainda foi detectado na última execução. Resolver agora não corrige o
                    dado — apenas registra a decisão.
                  </p>
                  {mayForce ? (
                    <label className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={forced}
                        onChange={(e) => setForced(e.target.checked)}
                      />
                      Confirmo o registro mesmo com o problema ainda presente.
                    </label>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Somente a administração pode registrar a resolução neste caso.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {pending === "IGNORED" && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Revisar novamente em (opcional)
              </p>
              <Input
                type="date"
                className="h-9 w-[170px]"
                value={ignoreUntil}
                onChange={(e) => setIgnoreUntil(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Depois desta data a ocorrência volta a ser cobrada automaticamente.
              </p>
            </div>
          )}

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={
              pending === "REOPEN"
                ? "Por que esta ocorrência precisa voltar?"
                : pending === "IGNORED"
                  ? "Justificativa obrigatória para ignorar…"
                  : pending === "RESOLVED"
                    ? "O que foi feito para resolver?"
                    : "Nota curta sobre esta ação…"
            }
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
              Cancelar
            </Button>
            <Button size="sm" onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

export function CommentsSection({
  comments,
  role,
  currentUserId,
  onAdd,
  onEdit,
  onArchive,
}: {
  comments: Mk9QualityCommentView[];
  role: string;
  currentUserId: string | null;
  onAdd: (body: string, visibility: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onArchive: (commentId: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("INTERNAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const mayComment = canComment(role);
  const preview = useMemo(() => sanitizeCommentBody(body), [body]);

  async function submit() {
    const check = sanitizeCommentBody(body);
    if (check.problems.length) {
      setError(COMMENT_PROBLEM_MESSAGE[check.problems[0]]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdd(body, visibility);
      setBody("");
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    const check = sanitizeCommentBody(editBody);
    if (check.problems.length) {
      setError(COMMENT_PROBLEM_MESSAGE[check.problems[0]]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onEdit(id, editBody);
      setEditingId(null);
    } catch (e) {
      setError(messageForError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <Separator />
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" /> Comentários
      </p>

      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum comentário. Use este espaço para registrar combinados e decisões.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-border/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium">{c.authorName ?? "Usuário"}</p>
                <div className="flex items-center gap-1.5">
                  {c.visibility === "CLIENT_VISIBLE" && (
                    <Badge variant="outline" className="text-[10px]">
                      Visível ao cliente
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground" title={dateTimeLabel(c.createdAt)}>
                    {relativeLabel(c.createdAt)}
                    {c.edited ? " · editado" : ""}
                  </span>
                </div>
              </div>

              {editingId === c.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => saveEdit(c.id)}>
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{c.body}</p>
              )}

              {canEditComment(role, currentUserId, c) && editingId !== c.id && (
                <div className="mt-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[11px]"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditBody(c.body);
                    }}
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                    disabled={busy}
                    onClick={() => onArchive(c.id).catch((e) => setError(messageForError(e)))}
                  >
                    <Trash2 className="h-3 w-3" /> Arquivar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {mayComment && (
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={body}
            maxLength={4000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Registre o combinado, o contato feito ou a decisão tomada…"
          />
          {preview.redacted && (
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
              Dados sensíveis (contato, chave, consulta ou erro técnico) serão removidos antes de
              gravar.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="h-9 w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNAL">Interno</SelectItem>
                <SelectItem value="CLIENT_VISIBLE">Visível ao cliente</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" disabled={busy || !body.trim()} onClick={submit}>
              {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Comentar
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Mensagens de erro em linguagem comum
// ---------------------------------------------------------------------------

const ERROR_MESSAGE: Record<string, string> = {
  MK9_DQ_STALE:
    "Esta ocorrência foi alterada por outra pessoa enquanto você editava. Atualize a tela e refaça a ação.",
  MK9_DQ_FORBIDDEN: "Seu papel não permite esta ação.",
  MK9_DQ_INVALID_TRANSITION: "Esta mudança de status não é possível a partir da situação atual.",
  MK9_DQ_REASON_REQUIRED: "É preciso justificar esta ação.",
  MK9_DQ_RESOLUTION_INVALID: "Informe o tipo de resolução e descreva o que foi feito.",
  MK9_DQ_RESOLUTION_TYPE_REQUIRED: "Selecione o tipo de resolução.",
  MK9_DQ_FORCE_JUSTIFICATION_REQUIRED:
    "Detalhe o motivo para registrar a resolução com o problema ainda presente.",
  MK9_DQ_ALREADY_OPEN: "Esta ocorrência já está em aberto.",
  MK9_DQ_ASSIGNEE_OUT_OF_SCOPE:
    "Esta pessoa não tem acesso a esta indústria ou região e não pode ser responsável.",
  MK9_DQ_ASSIGNEE_INVALID: "Este usuário não pode receber ocorrências.",
  MK9_DQ_COMMENT_INVALID: "O comentário não pôde ser gravado como está.",
  MK9_DQ_NOT_FOUND: "Ocorrência não encontrada no seu escopo.",
};

export function messageForError(error: unknown): string {
  const raw = String((error as any)?.message ?? "");
  for (const [code, message] of Object.entries(ERROR_MESSAGE)) {
    if (raw.includes(code)) return message;
  }
  return "Não foi possível concluir a ação agora. Tente novamente em instantes.";
}
