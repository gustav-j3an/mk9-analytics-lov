import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleDashboardSectionProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  storageKey: string;
  children: React.ReactNode;
  className?: string;
  isGrid?: boolean;
}

export function CollapsibleDashboardSection({
  title,
  subtitle,
  badge,
  defaultOpen = true,
  storageKey,
  children,
  className,
  isGrid = false,
}: CollapsibleDashboardSectionProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return defaultOpen;
    const stored = localStorage.getItem(`mk9_dashboard_section_${storageKey}`);
    return stored !== null ? stored === "true" : defaultOpen;
  });

  useEffect(() => {
    localStorage.setItem(`mk9_dashboard_section_${storageKey}`, String(isOpen));
    // Dispatch a custom event to sync "Collapse/Expand All" buttons
    window.dispatchEvent(new CustomEvent("mk9_dashboard_section_sync", {
      detail: { storageKey, isOpen }
    }));
  }, [isOpen, storageKey]);

  // Listen for global sync events
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail.storageKey === storageKey || e.detail.storageKey === "__ALL__") {
        setIsOpen(e.detail.isOpen);
      }
    };
    window.addEventListener("mk9_dashboard_section_sync", handleSync);
    return () => window.removeEventListener("mk9_dashboard_section_sync", handleSync);
  }, [storageKey]);

  return (
    <div className={cn("space-y-4", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between group/section hover:opacity-80 transition-opacity"
      >
        <div className="flex flex-col items-start text-left">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-foreground uppercase tracking-[0.2em]">
              {title}
            </h2>
            {badge && isOpen && <div className="animate-fade-in">{badge}</div>}
            {!isOpen && badge && (
               <div className="animate-fade-in">{badge}</div>
            )}
          </div>
          {subtitle && (
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isOpen && (
            <span className="text-[9px] font-black text-primary uppercase tracking-tighter opacity-0 group-hover/section:opacity-100 transition-opacity">
              Expandir
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform group-hover/section:text-primary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-hover/section:text-primary" />
          )}
        </div>
      </button>

      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        )}
      >
        <div className={cn(isGrid ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" : "")}>
          {children}
        </div>
      </div>
    </div>
  );
}
