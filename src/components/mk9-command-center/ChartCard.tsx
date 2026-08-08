import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, children, className }: ChartCardProps) {
  return (
    <div className={cn("glass-command p-6 rounded-2xl flex flex-col h-full", className)}>
      <div className="mb-6">
        <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">{title}</h3>
        {subtitle && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{subtitle}</p>}
      </div>
      <div className="h-[300px] w-full">
        {children}
      </div>
    </div>
  );
}
