import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { useServerFn } from "@tanstack/react-start";
import { mk9RecordLogin } from "@/lib/mk9-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — MK9 Analytics" },
      { name: "description", content: "Acesse o painel operacional MK9 Analytics." },
      { property: "og:title", content: "Entrar — MK9 Analytics" },
      { property: "og:description", content: "Acesso restrito ao painel operacional MK9 Analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useMk9Session();
  const recordLogin = useServerFn(mk9RecordLogin);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session?.user) navigate({ to: "/" });
  }, [loading, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("Se este e-mail existir, você receberá instruções para redefinir a senha.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) {
          try {
            await recordLogin();
          } catch {
            /* auditoria não deve bloquear login */
          }
          navigate({ to: "/" });
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border/70 shadow-[var(--shadow-elevated)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <BarChart3 className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">MK9 Analytics</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "forgot" ? "Recuperar acesso" : "Entre na sua conta"}
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="mb-1 block text-xs font-medium">E-mail</label>
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
              />
            </div>
            {mode === "login" && (
              <div>
                <label className="mb-1 block text-xs font-medium">Senha</label>
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                {notice}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "forgot" ? "Enviar link" : "Entrar"}
            </Button>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {mode === "login" ? (
                <button type="button" className="hover:text-foreground" onClick={() => setMode("forgot")}>
                  Esqueci minha senha
                </button>
              ) : (
                <button type="button" className="hover:text-foreground" onClick={() => setMode("login")}>
                  Voltar ao login
                </button>
              )}
              <Link to="/" className="hover:text-foreground">
                Início
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
