import { useState } from "react";
import { 
  ShieldCheck, 
  Activity, 
  PlayCircle, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  RefreshCw,
  FileText,
  Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type HealthStatus = "OK" | "WARNING" | "ERROR" | "IDLE";

interface ValidationItem {
  id: string;
  category: string;
  label: string;
  status: HealthStatus;
  message?: string;
}

export function Mk9HomologationModule() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ValidationItem[]>([]);

  const runFullHealthCheck = async () => {
    setIsRunning(true);
    setProgress(0);
    setResults([]);

    const steps = [
      { category: "Importações", label: "Checklists Duplicados", delay: 800 },
      { category: "Importações", label: "Competências Conflitantes", delay: 600 },
      { category: "Lojas", label: "Lojas sem UF/Cidade", delay: 1000 },
      { category: "Indústrias", label: "Frequências Versão Única", delay: 700 },
      { category: "Promotores", label: "Roteiros Órfãos", delay: 900 },
      { category: "Banco", label: "FKs e Integridade", delay: 1200 },
      { category: "Dashboard", label: "Paridade Dashboard/Cockpit", delay: 1500 },
    ];

    let currentResults: ValidationItem[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await new Promise(r => setTimeout(r, step.delay));
      
      const newResult: ValidationItem = {
        id: Math.random().toString(),
        category: step.category,
        label: step.label,
        status: "OK", // Mock OK for now
      };
      
      currentResults = [...currentResults, newResult];
      setResults(currentResults);
      setProgress(((i + 1) / steps.length) * 100);
    }

    setIsRunning(false);
    toast.success("Verificação completa finalizada.");
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case "OK": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "WARNING": return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "ERROR": return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saúde do Sistema</h1>
          <p className="text-muted-foreground">Homologação operacional e integridade de dados MK9.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Gerar Relatório PDF
          </Button>
          <Button 
            onClick={runFullHealthCheck} 
            disabled={isRunning}
            className="gap-2 shadow-lg shadow-primary/20"
          >
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Executar Verificação Completa
          </Button>
        </div>
      </div>

      {isRunning && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Processando validações...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Logs de Verificação
            </CardTitle>
            <CardDescription>Detalhamento das últimas validações executadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
                <Activity className="h-10 w-10 mb-2 opacity-20" />
                <p>Nenhuma verificação executada recentemente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((res) => (
                  <div key={res.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(res.status)}
                      <div>
                        <p className="text-sm font-medium">{res.label}</p>
                        <p className="text-xs text-muted-foreground">{res.category}</p>
                      </div>
                    </div>
                    <Badge variant={res.status === "OK" ? "outline" : "destructive"} className={res.status === "OK" ? "border-emerald-500/50 text-emerald-600 bg-emerald-50" : ""}>
                      {res.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Status Geral</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Importações", status: "OK" },
                { label: "Lojas", status: "OK" },
                { label: "Indústrias", status: "OK" },
                { label: "Promotores", status: "OK" },
                { label: "Roteiros", status: "OK" },
                { label: "Dashboard", status: "OK" },
                { label: "Banco", status: "OK" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs font-bold text-emerald-600">OK</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
                <Wrench className="h-4 w-4" />
                Ações Sugeridas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-amber-600 mb-4">
                Problemas seguros detectados podem ser corrigidos automaticamente.
              </p>
              <Button size="sm" variant="outline" className="w-full border-amber-200 text-amber-700 hover:bg-amber-100">
                Corrigir Automaticamente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
