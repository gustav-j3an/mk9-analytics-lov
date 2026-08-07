import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { useServerFn } from "@tanstack/react-start";
import { mk9RecordLogin } from "@/lib/mk9-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2, ShieldCheck, Database, FileCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    title: "MK9 Analytics | Acesso",
    meta: [
      { name: "description", content: "Sistema central de inteligência operacional MK9." },
      { property: "og:title", content: "MK9 Analytics" },
      { property: "og:description", content: "Painel operacional e relatórios automatizados." },
      { name: "twitter:card", content: "summary_large_image" }
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
    // Redireciona para o Cockpit se já estiver logado
    if (!loading && session?.user) {
      navigate({ to: "/cockpit" });
    }
  }, [loading, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setNotice("Se este e-mail existir, você receberá instruções para redefinir a senha.");
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ 
          email: email.trim(), 
          password: password.trim() 
        });
        
        if (authError) throw authError;
        
        if (data.session) {
          try {
            await recordLogin();
          } catch (auditErr) {
            console.warn("Falha ao registrar log de acesso:", auditErr);
          }
          navigate({ to: "/cockpit" });
        }
      }
    } catch (err: any) {
      console.error("Erro na autenticação:", err);
      setError(err?.message ?? "Falha na operação. Verifique suas credenciais.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <ShieldCheck className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">MK9 Analytics</h1>
          <p className="text-slate-400">
            Painel operacional para auditoria e gestão de campo.
          </p>
        </div>

        <Card className="w-full border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl text-white">
              {mode === "forgot" ? "Recuperar acesso" : "Entre na sua conta"}
            </CardTitle>
            <p className="text-sm text-slate-400">
              {mode === "forgot" ? "Insira seu e-mail para receber o link" : "Use suas credenciais corporativas"}
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 ml-1">E-mail</label>
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  className="bg-slate-950/50 border-slate-800 text-white placeholder:text-slate-600 focus:ring-primary/20"
                />
              </div>
              
              {mode === "login" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300 ml-1">Senha</label>
                    <button 
                      type="button" 
                      className="text-xs text-primary hover:text-primary/80 transition-colors" 
                      onClick={() => setMode("forgot")}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-950/50 border-slate-800 text-white focus:ring-primary/20"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-in fade-in slide-in-from-top-1">
                  {error}
                </div>
              )}

              {notice && (
                <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary-foreground animate-in fade-in slide-in-from-top-1">
                  {notice}
                </div>
              )}

              <Button type="submit" className="w-full h-11 text-base font-semibold transition-all hover:scale-[1.01]" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (mode === "forgot" ? "Enviar link de recuperação" : "Entrar no Sistema")}
              </Button>

              {mode === "forgot" && (
                <button 
                  type="button" 
                  className="w-full text-sm text-slate-400 hover:text-white transition-colors py-2" 
                  onClick={() => setMode("login")}
                >
                  Voltar ao login
                </button>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm">
            <Database className="w-5 h-5 text-blue-400 mb-2" />
            <h3 className="text-sm font-medium text-slate-200">Base Integrada</h3>
            <p className="text-xs text-slate-500">Dados consolidados de indústrias e lojas.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm">
            <FileCheck className="w-5 h-5 text-emerald-400 mb-2" />
            <h3 className="text-sm font-medium text-slate-200">Auditoria PDF</h3>
            <p className="text-xs text-slate-500">Relatórios operacionais automáticos.</p>
          </div>
        </div>

        <div className="text-center text-xs text-slate-600 pt-4">
          © 2026 MK9 Analytics. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
