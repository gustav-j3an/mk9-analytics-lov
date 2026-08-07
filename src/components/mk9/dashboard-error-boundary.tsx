import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  title?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Dashboard Widget Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className={`border-destructive/20 bg-destructive/5 flex flex-col items-center justify-center p-6 text-center ${this.props.className}`}>
          <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
          <h3 className="font-semibold text-destructive text-sm">{this.props.title || "Erro no Widget"}</h3>
          <p className="text-[10px] text-muted-foreground mt-1 max-w-[250px] leading-tight">
            Não foi possível carregar estes dados devido a uma inconsistência ou erro de processamento.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-2 text-[9px] text-left overflow-auto max-w-full bg-slate-900/10 p-2 rounded">
              {this.state.error.message}
            </pre>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-4 h-8 text-xs" 
            onClick={() => this.setState({ hasError: false })}
          >
            <RefreshCcw className="h-3 w-3 mr-2" /> Tentar novamente
          </Button>
        </Card>
      );
    }

    return this.props.children;
  }
}
