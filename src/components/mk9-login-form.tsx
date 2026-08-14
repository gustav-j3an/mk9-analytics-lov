import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

type OAuthProvider = "google" | "apple" | "microsoft";

export function Mk9LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(
          error.message === "Invalid login credentials"
            ? "Credenciais inválidas. Verifique seu e-mail e senha."
            : error.message,
        );
      } else if (data.session) {
        toast.success("Login realizado com sucesso!");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error("Ocorreu um erro ao tentar entrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        toast.error(
          result.error instanceof Error
            ? result.error.message
            : "Erro ao iniciar login social.",
        );
      }
      // Em fluxos não-redirect, a sessão já é injetada pelo helper da Lovable
      // e o useMk9Session redireciona automaticamente para o destino correto.
    } catch (err: any) {
      toast.error("Ocorreu um erro ao tentar entrar com " + provider + ".");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="space-y-2 text-center">
        <div className="flex justify-center mb-2">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <ShieldCheck className="text-primary-foreground h-7 w-7" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          MK9 <span className="text-primary">Analytics</span>
        </CardTitle>
        <CardDescription>Entre com suas credenciais para acessar o painel.</CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
            </div>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/50"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full font-semibold py-6 text-base" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar no Sistema"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
