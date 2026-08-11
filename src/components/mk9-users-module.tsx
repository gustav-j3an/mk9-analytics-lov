import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  mk9ListUsers,
  mk9CreateUser,
  mk9SetUserActive,
  mk9AssignRole,
  mk9RemoveRole,
  type Mk9UserRow,
} from "@/lib/mk9-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  X,
  Shield,
  Ban,
  Check,
  Users,
  Search,
  MoreVertical,
  UserPlus,
  Key,
  ShieldAlert,
  Clock,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mk9Panel,
  Mk9PageHeader,
  Mk9MetricCard,
  Mk9LoadingState,
  Mk9EmptyState,
  Mk9Badge,
} from "@/components/mk9/design-system";
import { toast } from "sonner";

const ROLES = ["ADMIN", "SUPERVISOR", "PROMOTOR", "CLIENTE", "AUDITOR"] as const;
type Role = (typeof ROLES)[number];

export function Mk9UsersModule({ currentUserId }: { currentUserId: string | null }) {
  const qc = useQueryClient();
  const listFn = useServerFn(mk9ListUsers);
  const createFn = useServerFn(mk9CreateUser);
  const setActiveFn = useServerFn(mk9SetUserActive);
  const assignFn = useServerFn(mk9AssignRole);
  const removeFn = useServerFn(mk9RemoveRole);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["mk9-users-admin"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "PROMOTOR" as Role });

  const filtered = useMemo(() => {
    return users.filter(
      (u: Mk9UserRow) =>
        (u.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
        (u.email?.toLowerCase() || "").includes(search.toLowerCase()),
    );
  }, [users, search]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u: any) => u.active).length,
      admins: users.filter((u: any) => u.roles.includes("ADMIN")).length,
    };
  }, [users]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createFn({ data: form });
      setForm({ email: "", password: "", name: "", role: "PROMOTOR" });
      setShowNew(false);
      await qc.invalidateQueries({ queryKey: ["mk9-users-admin"] });
      toast.success("Usuário criado com sucesso.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar usuário.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: Mk9UserRow) {
    try {
      await setActiveFn({ data: { userId: u.userId, active: !u.active } });
      await qc.invalidateQueries({ queryKey: ["mk9-users-admin"] });
      toast.success(u.active ? "Usuário desativado." : "Usuário ativado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao alterar status.");
    }
  }

  async function addRole(u: Mk9UserRow, role: Role) {
    try {
      await assignFn({ data: { userId: u.userId, role } });
      await qc.invalidateQueries({ queryKey: ["mk9-users-admin"] });
      toast.success(`Papel ${role} atribuído.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao atribuir papel.");
    }
  }

  async function dropRole(u: Mk9UserRow, role: Role) {
    try {
      await removeFn({ data: { userId: u.userId, role } });
      await qc.invalidateQueries({ queryKey: ["mk9-users-admin"] });
      toast.success(`Papel ${role} removido.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao remover papel.");
    }
  }

  if (isLoading) return <Mk9LoadingState message="Carregando usuários..." />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Mk9PageHeader
        title="Controle de Acesso"
        subtitle="Gestão de identidades, papéis e permissões do sistema"
        icon={ShieldAlert}
        actions={
          <Button
            onClick={() => setShowNew(true)}
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-foreground font-black uppercase tracking-widest px-6 shadow-lg shadow-mk9-accent-primary/20 border-none"
          >
            <UserPlus className="h-4 w-4 mr-2" /> Novo Usuário
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Mk9MetricCard label="Total de Usuários" value={stats.total} icon={Users} color="purple" />
        <Mk9MetricCard label="Acessos Ativos" value={stats.active} icon={Check} color="emerald" />
        <Mk9MetricCard label="Administradores" value={stats.admins} icon={Shield} color="blue" />
      </div>

      {showNew && (
        <Mk9Panel className="animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-mk9-accent-primary/10 border border-mk9-accent-primary/20">
              <UserPlus className="h-4 w-4 text-mk9-accent-primary" />
            </div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
              Novo Cadastro de Acesso
            </h3>
          </div>

          <form className="grid gap-6 md:grid-cols-2" onSubmit={createUser}>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                E-mail de Login *
              </label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-input/50 border-border text-foreground h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Nome Completo
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-input/50 border-border text-foreground h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Senha Temporária (Mín. 8 caracteres)
              </label>
              <Input
                type="password"
                minLength={8}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="bg-input/50 border-border text-foreground h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Papel Inicial
              </label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Role })}
              >
                <SelectTrigger className="bg-input/50 border-border h-10 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-command-deep border-border">
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNew(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-foreground font-black uppercase tracking-widest px-8"
              >
                {busy ? "Processando..." : "Finalizar Cadastro"}
              </Button>
            </div>
          </form>
        </Mk9Panel>
      )}

      <Mk9Panel>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              className="pl-10 bg-white/[0.03] border-border text-foreground placeholder:text-slate-600 focus:ring-mk9-accent-primary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                <th className="px-4 py-4 text-left font-black">Usuário / Identidade</th>
                <th className="px-4 py-4 text-left font-black">Papéis Atribuídos</th>
                <th className="px-4 py-4 text-left font-black">Status</th>
                <th className="px-4 py-4 text-left font-black">Último Acesso</th>
                <th className="px-4 py-4 text-right font-black">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <Mk9EmptyState message="Nenhum usuário encontrado." />
                  </td>
                </tr>
              ) : (
                filtered.map((u: Mk9UserRow) => (
                  <tr key={u.userId} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground group-hover:text-mk9-accent-primary transition-colors">
                          {u.name || "Sem Nome"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono tracking-tight uppercase">
                          {u.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.map((r) => (
                          <Mk9Badge key={r} className="flex items-center gap-1 py-1 pr-1.5">
                            <Shield className="h-2.5 w-2.5 text-mk9-accent-primary" />
                            {r}
                            <button
                              onClick={() => dropRole(u, r)}
                              className="ml-1 opacity-40 hover:opacity-100 hover:text-rose-500 transition-all"
                              disabled={u.userId === currentUserId && r === "ADMIN"}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Mk9Badge>
                        ))}
                        <Select onValueChange={(v) => addRole(u, v as Role)}>
                          <SelectTrigger className="h-6 w-24 bg-muted/50 border-border text-[9px] font-black uppercase tracking-widest px-2">
                            <SelectValue placeholder="+ PAPEL" />
                          </SelectTrigger>
                          <SelectContent className="bg-command-deep border-border">
                            {ROLES.filter((r) => !u.roles.includes(r)).map((r) => (
                              <SelectItem
                                key={r}
                                value={r}
                                className="text-[10px] font-bold uppercase tracking-widest"
                              >
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {u.active ? (
                        <Mk9Badge variant="success" className="flex items-center gap-1.5">
                          <Check className="h-2.5 w-2.5" /> Ativo
                        </Mk9Badge>
                      ) : (
                        <Mk9Badge variant="danger" className="flex items-center gap-1.5">
                          <Ban className="h-2.5 w-2.5" /> Inativo
                        </Mk9Badge>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="text-[10px] font-mono">
                          {u.lastLoginAt
                            ? new Date(u.lastLoginAt).toLocaleString("pt-BR")
                            : "NUNCA"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-command-deep border-border text-foreground"
                        >
                          <DropdownMenuItem
                            onClick={() => toggleActive(u)}
                            disabled={u.userId === currentUserId}
                            className="gap-2 cursor-pointer hover:bg-accent"
                          >
                            {u.active ? (
                              <Ban className="h-3.5 w-3.5 text-rose-400" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                            {u.active ? "Desativar Acesso" : "Reativar Acesso"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer hover:bg-accent">
                            <Key className="h-3.5 w-3.5" /> Resetar Senha
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Mk9Panel>
    </div>
  );
}
