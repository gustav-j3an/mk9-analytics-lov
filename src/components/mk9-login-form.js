import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
export function Mk9LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) {
                toast.error(error.message === "Invalid login credentials"
                    ? "Credenciais inválidas. Verifique seu e-mail e senha."
                    : error.message);
            }
            else {
                toast.success("Login realizado com sucesso!");
            }
        }
        catch (err) {
            toast.error("Ocorreu um erro ao tentar entrar.");
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="flex min-h-screen items-center justify-center bg-[#f8fafc] dark:bg-[#020617] px-4">
      <Card className="w-full max-w-md shadow-xl border-border/50 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <ShieldCheck className="text-primary-foreground h-7 w-7"/>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">MK9 <span className="text-primary">Analytics</span></CardTitle>
          <CardDescription>
            Entre com suas credenciais para acessar o painel.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background/50"/>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-background/50"/>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full font-semibold py-6 text-base" type="submit" disabled={loading}>
              {loading ? (<>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Entrando...
                </>) : ("Entrar no Sistema")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>);
}
