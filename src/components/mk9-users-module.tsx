import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X, Shield, Ban, Check } from "lucide-react";

const ROLES = ["ADMIN", "SUPERVISOR", "PROMOTOR", "CLIENTE", "AUDITOR"] as const;
type Role = (typeof ROLES)[number];

export function Mk9UsersModule({ currentUserId }: { currentUserId: string | null }) {
  const qc = useQueryClient();
  const listFn = useServerFn(mk9ListUsers);
  const createFn = useServerFn(mk9CreateUser);
  const setActiveFn = useServerFn(mk9SetUserActive);
  const assignFn = useServerFn(mk9AssignRole);
  const removeFn = useServerFn(mk9RemoveRole);

  const q = useQuery({ queryKey: ["mk9-users"], queryFn: () => listFn() });
  const users = q.data ?? [];

  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "PROMOTOR" as Role });

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await createFn({ data: form });
      setForm({ email: "", password: "", name: "", role: "PROMOTOR" });
      setShowNew(false);
      await qc.invalidateQueries({ queryKey: ["mk9-users"] });
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao criar usuário.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: Mk9UserRow) {
    await setActiveFn({ data: { userId: u.userId, active: !u.active } });
    qc.invalidateQueries({ queryKey: ["mk9-users"] });
  }

  async function addRole(u: Mk9UserRow, role: Role) {
    await assignFn({ data: { userId: u.userId, role } });
    qc.invalidateQueries({ queryKey: ["mk9-users"] });
  }

  async function dropRole(u: Mk9UserRow, role: Role) {
    try {
      await removeFn({ data: { userId: u.userId, role } });
      qc.invalidateQueries({ queryKey: ["mk9-users"] });
    } catch (e: any) {
      alert(e?.message ?? "Falha ao remover papel.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Usuários</h2>
          <p className="text-sm text-muted-foreground">Gestão de acesso ao MK9 Analytics.</p>
        </div>
        <Button onClick={() => setShowNew((v) => !v)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo usuário
        </Button>
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Criar usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={createUser}>
              <div>
                <label className="mb-1 block text-xs font-medium">E-mail</label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Nome</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Senha inicial (mín. 8)</label>
                <Input type="password" minLength={8} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Papel</label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {err && (
                <p className="md:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {err}
                </p>
              )}
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Nenhum usuário cadastrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Usuário</th>
                    <th className="px-4 py-3 text-left">Papéis</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Último acesso</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.userId} className="border-t border-border/70 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{u.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 && <Badge variant="outline" className="text-[10px]">sem papel</Badge>}
                          {u.roles.map((r) => (
                            <Badge key={r} variant="secondary" className="gap-1 text-[10px]">
                              <Shield className="h-3 w-3" /> {r}
                              <button
                                onClick={() => dropRole(u, r)}
                                className="ml-1 opacity-60 hover:opacity-100"
                                title="Remover papel"
                                disabled={u.userId === currentUserId && r === "ADMIN"}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          <Select onValueChange={(v) => addRole(u, v as Role)}>
                            <SelectTrigger className="h-6 w-[110px] text-[10px]">
                              <SelectValue placeholder="+ papel" />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.filter((r) => !u.roles.includes(r)).map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.active ? (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-600"><Check className="h-3 w-3" /> Ativo</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground"><Ban className="h-3 w-3" /> Inativo</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(u)} disabled={u.userId === currentUserId}>
                          {u.active ? "Desativar" : "Ativar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
