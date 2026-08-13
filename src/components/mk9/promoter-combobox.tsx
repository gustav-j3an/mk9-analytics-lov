// Combobox pesquisável de promotores (Missão 8A.3).
// Lista compacta com scroll interno (max-height ~280px) — nunca ocupa a tela.

import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PromoterOption {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  promoters: PromoterOption[];
  disabled?: boolean;
  placeholder?: string;
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function Mk9PromoterCombobox({
  value,
  onChange,
  promoters,
  disabled,
  placeholder = "Digite o nome do promotor…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => promoters.find((p) => p.id === value) ?? null,
    [promoters, value],
  );

  const results = useMemo(() => {
    const q = normalize(input.trim());
    const list = [...promoters].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list.slice(0, 50);
    return list.filter((p) => normalize(p.name).includes(q)).slice(0, 50);
  }, [promoters, input]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setTimeout(() => inputRef.current?.focus(), 30);
        else setInput("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-9",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <User className="h-4 w-4 opacity-60 shrink-0" />
            <span className="truncate text-xs">{selected?.name ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[--radix-popover-trigger-width] p-0 rounded-xl border shadow-lg overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 opacity-60 shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite o nome do promotor…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="overflow-y-auto overscroll-contain p-1" style={{ maxHeight: 280 }}>
          {results.length === 0 && (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">
              Nenhum promotor encontrado.
            </p>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2 my-0.5 rounded-lg transition-colors flex items-center justify-between gap-2",
                "hover:bg-accent focus:bg-accent focus:outline-none",
                p.id === value && "bg-accent",
              )}
            >
              <span className="text-xs font-medium truncate">{p.name}</span>
              {p.id === value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
