import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2, UserPlus, Shield, MessageSquare, ExternalLink, Calendar, Copy, Check, QrCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  mk9CreatePromoter,
  mk9UpdatePromoter,
  mk9DeletePromoter,
  mk9PromoterDeleteImpact,
  mk9GetPromoterAccessStatus,
} from "@/lib/mk9-promoters.functions";
import { listPresenceTeams } from "@/lib/mk9-presence-teams.functions";
import { listSupervisors } from "@/lib/mk9-supervisors.functions";
import { mk9ListProfiles } from "@/lib/mk9-data.functions";
import { mk9CreateUser } from "@/lib/mk9-users.functions";
import { Mk9Badge, Mk9MetricCard, Mk9Panel } from "./design-system";


export function PromoterDialog({
  open,
  onClose,
  promoter = null,
}: {
  open: boolean;
  onClose: () => void;
  promoter?: any;
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(mk9CreatePromoter);
  const updateFn = useServerFn(mk9UpdatePromoter);
  const listTeamsFn = useServerFn(listPresenceTeams);
  const listSupervisorsFn = useServerFn(listSupervisors);
  const listProfilesFn = useServerFn(mk9ListProfiles);

  const { data: profiles } = useQuery({
    queryKey: ["mk9-profiles-list"],
    queryFn: () => listProfilesFn(),
    enabled: open
  });

  
  const { data: teams } = useQuery({
    queryKey: ["mk9-presence-teams-list"],
    queryFn: () => listTeamsFn(),
    enabled: open
  });

  const { data: supervisors } = useQuery({
    queryKey: ["mk9-supervisors-list"],
    queryFn: () => listSupervisorsFn(),
    enabled: open
  });

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [externalId, setExternalId] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [presenceTeamId, setPresenceTeamId] = useState<string | null>(null);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);


  useEffect(() => {
    if (promoter) {
      setName(promoter.name || "");
      setCity(promoter.city || "");
      setUf(promoter.uf || "");
      setContact(promoter.contact || "");
      setNotes(promoter.notes || "");
      setExternalId(promoter.externalId || "");
      setEmployeeNumber(promoter.employeeNumber || "");
      setPresenceTeamId(promoter.presence_team_id || null);
      setSupervisorId(promoter.mk9_supervisor_id || null);
      setUserId(promoter.user_id || null);

    } else {
      setName("");
      setCity("");
      setUf("");
      setContact("");
      setNotes("");
      setExternalId("");
      setEmployeeNumber("");
      setPresenceTeamId(null);
      setSupervisorId(null);
      setUserId(null);

    }
  }, [promoter, open]);

  const createUserFn = useServerFn(mk9CreateUser);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");


  const handleCreateUser = async () => {
    if (!newUserEmail || newUserEmail.length < 5) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setCreatingUser(true);
    try {
      const res = await createUserFn({ 
        data: { 
          email: newUserEmail, 
          name: name,
          role: "PROMOTOR"
        } 
      });

      setUserId(res.userId);
      await queryClient.invalidateQueries({ queryKey: ["mk9-profiles-list"] });
      toast.success("Usuário criado e vinculado com sucesso.");
    } catch (err: any) {
      toast.error(err.message || "Falha ao criar usuário.");
    } finally {
      setCreatingUser(false);
    }
  };

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        city,
        uf: uf.toUpperCase(),
        contact,
        notes,
        externalId,
        employeeNumber,
        presenceTeamId: presenceTeamId || null,
        supervisorId: supervisorId || null,
        userId: userId || null,

      };
      if (promoter) {
        return updateFn({
          data: {
            id: promoter.id,
            data: payload,
            expectedUpdatedAt: promoter.updatedAt,
          },
        });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(promoter ? "Promotor atualizado." : "Promotor criado.");
      queryClient.invalidateQueries({ queryKey: ["mk9-promoters-admin"] });
      queryClient.invalidateQueries({ queryKey: ["mk9-promoters"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar promotor."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-mk9-accent-primary uppercase">
            {promoter ? "Editar Promotor" : "Novo Promotor"}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {promoter ? "Gerenciamento de perfil operacional" : "Inclusão de novo agente de campo"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Nome Completo *
              </Label>
              <Input
                className="bg-input/50 border-border h-10 text-foreground"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do promotor"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Matrícula
              </Label>
              <Input
                className="bg-input/50 border-border h-10 text-foreground"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="001245"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Cidade
              </Label>
              <Input
                className="bg-input/50 border-border h-10 text-foreground"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: São Paulo"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                UF
              </Label>
              <Input
                className="bg-input/50 border-border h-10 text-foreground font-mono"
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="SP"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                ID Externo
              </Label>
              <Input
                className="bg-input/50 border-border h-10 text-foreground"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="ERP ID"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Supervisor MK9
              </Label>
              <Select value={supervisorId || "NONE"} onValueChange={(val) => setSupervisorId(val === "NONE" ? null : val)}>
                <SelectTrigger className="bg-input/50 border-border h-10 text-foreground text-xs">
                  <SelectValue placeholder="Sem Supervisor" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="NONE">Sem Supervisor</SelectItem>
                  {supervisors?.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Equipe de Presença
              </Label>
              <Select value={presenceTeamId || "NONE"} onValueChange={(val) => setPresenceTeamId(val === "NONE" ? null : val)}>
                <SelectTrigger className="bg-input/50 border-border h-10 text-foreground text-xs">
                  <SelectValue placeholder="Sem Equipe" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  <SelectItem value="NONE">Sem Equipe (Avulso)</SelectItem>
                  {teams?.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-4 border border-border/50 rounded-xl bg-muted/20 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-mk9-accent-primary" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground">
                Acesso ao Portal do Promotor
              </h4>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                  Vincular Usuário Existente
                </Label>
                <Select value={userId || "NONE"} onValueChange={(val) => setUserId(val === "NONE" ? null : val)}>
                  <SelectTrigger className="bg-input/50 border-border h-10 text-foreground text-xs">
                    <SelectValue placeholder="Selecione um acesso..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-foreground">
                    <SelectItem value="NONE">Nenhum vínculo</SelectItem>
                    {profiles?.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.email} ({p.name || "Sem Nome"})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!userId && (
                <div className="pt-2 border-t border-border/30 space-y-3">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center">
                    OU CRIAR NOVO ACESSO
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="E-mail do novo acesso"
                      className="bg-input/50 border-border h-9 text-xs"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="h-9 border-mk9-accent-primary/50 text-mk9-accent-primary hover:bg-mk9-accent-primary/10 text-[10px] font-black uppercase tracking-widest"
                      onClick={handleCreateUser}
                      disabled={creatingUser || !newUserEmail}
                    >
                      {creatingUser ? <Loader2 className="h-3 w-3 animate-spin" /> : "CRIAR ACESSO"}
                    </Button>
                  </div>
                </div>
              )}

              {userId && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                    Acesso Vinculado
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Contato (Telefone/Email)
            </Label>
            <Input
              className="bg-input/50 border-border h-10 text-foreground"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Observações
            </Label>
            <Textarea
              className="bg-input/50 border-border text-foreground min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas..."
            />
          </div>
        </div>
        <DialogFooter className="mt-4 border-t border-border/50 pt-4">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            CANCELAR
          </Button>
          <Button
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-foreground font-bold"
            onClick={() => mut.mutate()}
            disabled={!name || mut.isPending}
          >
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "SALVAR PROMOTOR"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PromoterDeleteDialog({
  open,
  onClose,
  promoter,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  promoter: any;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const impactFn = useServerFn(mk9PromoterDeleteImpact);
  const deleteFn = useServerFn(mk9DeletePromoter);

  const { data: impact, isLoading } = useQuery({
    queryKey: ["mk9-promoter-delete-impact", promoter?.id],
    queryFn: () => impactFn({ data: { id: promoter.id } }),
    enabled: open && !!promoter?.id,
  });

  const mut = useMutation({
    mutationFn: async () => deleteFn({ data: { id: promoter.id } }),
    onSuccess: (res) => {
      toast.success(
        res.mode === "HARD"
          ? "Promotor excluído permanentemente."
          : "Promotor removido da listagem ativa.",
      );
      queryClient.invalidateQueries({ queryKey: ["mk9-promoters-admin"] });
      queryClient.invalidateQueries({ queryKey: ["mk9-promoters"] });
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir promotor."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-500 font-black tracking-tighter uppercase">
            <AlertTriangle className="h-5 w-5" />
            Excluir Promotor
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Ação irreversível ou desativação de histórico.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-mk9-accent-primary/20" />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              Analisando histórico operacional...
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="bg-muted/50 border border-border/50 rounded-xl p-4 transition-all">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    Agente
                  </p>
                  <p className="text-xs font-bold text-foreground">{promoter?.name}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    Matrícula
                  </p>
                  <p className="text-xs font-mono text-foreground/80">
                    {promoter?.employeeNumber || "—"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    Região
                  </p>
                  <p className="text-xs text-foreground/80">
                    {promoter?.uf || "—"} / {promoter?.city || "—"}
                  </p>
                </div>
              </div>
            </div>

            {impact && (impact.routes > 0 || impact.visits > 0) ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    Restrição de Exclusão
                  </p>
                </div>
                <p className="text-xs text-amber-400 opacity-80 leading-relaxed">
                  Este agente possui <strong>{impact.visits} visitas</strong> e{" "}
                  <strong>{impact.routes} roteiros</strong> registrados. Para manter a integridade
                  dos relatórios, ele será <strong>arquivado</strong> e removido da listagem ativa.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                  Sem histórico vinculado. Exclusão física permitida.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 border-t border-border/50 pt-4">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={onClose}
            disabled={mut.isPending}
          >
            CANCELAR
          </Button>
          <Button
            className="bg-rose-500 hover:bg-rose-600 text-foreground font-bold px-6 shadow-lg shadow-rose-500/20"
            onClick={() => mut.mutate()}
            disabled={isLoading || mut.isPending}
          >
            {mut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "CONFIRMAR EXCLUSÃO"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PromoterInviteDialog({
  open,
  onClose,
  promoter,
}: {
  open: boolean;
  onClose: () => void;
  promoter: any;
}) {
  const getStatusFn = useServerFn(mk9GetPromoterAccessStatus);
  const { data: status, isLoading } = useQuery({
    queryKey: ["mk9-promoter-access-status", promoter?.id],
    queryFn: () => getStatusFn({ data: { id: promoter.id } }),
    enabled: open && !!promoter?.id,
  });

  const portalUrl = typeof window !== "undefined" ? window.location.origin + "/mk9-portal" : "https://mk9-analytics.lovable.app/mk9-portal";
  const message = promoter ? `Olá, ${promoter.name}.

Seu acesso ao MK9 Promotor está disponível.

Portal:
${portalUrl}

Login:
${status?.email || "Seu e-mail cadastrado"}

Acesse pelo celular Android.
Após entrar, você verá somente sua rota e poderá enviar a foto de cada visita.

Se quiser instalar como aplicativo:
abra o link pelo Google Chrome e escolha "Instalar aplicativo".` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada para a área de transferência.");
  };

  const handleWhatsApp = () => {
    if (!promoter?.contact) {
      toast.error("Promotor não possui telefone cadastrado.");
      return;
    }
    const phone = promoter.contact.replace(/\D/g, "");
    const url = `https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-mk9-accent-primary font-black tracking-tighter uppercase">
            <MessageSquare className="h-5 w-5" />
            Enviar Convite ao Portal
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Acesso exclusivo ao roteiro do promotor.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="bg-muted/30 border border-border/50 rounded-xl p-4 space-y-4">
               <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                      Acesso Vinculado
                    </span>
                  </div>
                  <Mk9Badge variant={status?.isActive ? "success" : "danger"}>
                    {status?.isActive ? "ATIVO" : "INATIVO"}
                  </Mk9Badge>
               </div>
               
               <div className="space-y-2">
                 <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                   Mensagem de Boas-vindas
                 </p>
                 <div className="bg-background/50 p-3 rounded-lg border border-border/30 text-[11px] leading-relaxed font-mono whitespace-pre-wrap">
                   {message}
                 </div>
               </div>
            </div>

            {status?.plannedVisits === 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest leading-tight">
                  Este promotor não possui roteiro para o mês de {status.month}/{status.year}.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 border-t border-border/50 pt-4 flex-col sm:flex-row gap-2">
          <div className="flex flex-1 gap-2">
            <Button
              variant="outline"
              className="flex-1 border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest"
              onClick={handleCopy}
            >
              <Copy className="h-3.5 w-3.5 mr-2" /> COPIAR
            </Button>
            <Button
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest"
              onClick={handleWhatsApp}
              disabled={!promoter?.contact}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-2" /> WHATSAPP
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
