// Autocomplete assíncrono de lojas MK9 — estilo Notion/Slack/Google.
// Só consulta o banco quando o usuário digita ≥ 2 caracteres.
// Debounce de 300 ms + cache em memória por termo normalizado.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Loader2, Search, Store as StoreIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mk9StoresSearch, mk9StoreGet } from "@/lib/mk9-routes.functions";

export interface StoreOption {
  id: string;
  name: string;
  chain: string | null;
  uf: string | null;
  city?: string | null;
}

interface Props {
  value: string; // store_id
  onChange: (store: StoreOption) => void;
  initialLabel?: string | null;
  disabled?: boolean;
  placeholder?: string;
}

export function Mk9StoreAutocomplete({
  value,
  onChange,
  initialLabel,
  disabled,
  placeholder = "Selecione a loja…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<StoreOption | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const searchFn = useServerFn(mk9StoresSearch);
  const getFn = useServerFn(mk9StoreGet);
  const qc = useQueryClient();

  // Debounce ~300 ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  // Modo edição: carrega apenas a loja atual para exibir label.
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    let cancel = false;
    (async () => {
      const cached = qc.getQueryData<StoreOption | null>(["mk9-store", value]);
      if (cached) {
        if (!cancel) setSelected(cached);
        return;
      }
      try {
        const row = await getFn({ data: { id: value } });
        if (!cancel && row) {
          qc.setQueryData(["mk9-store", value], row);
          setSelected(row);
        }
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [value, selected?.id, getFn, qc]);

  const searchQ = useQuery({
    queryKey: ["mk9-stores-search", debounced],
    queryFn: () => searchFn({ data: { q: debounced } }),
    enabled: open && debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const data = searchQ.data;
  const results: StoreOption[] = Array.isArray(data) ? [] : (data?.items ?? []);
  const total: number = Array.isArray(data) ? 0 : (data?.total ?? 0);
  const showHint = debounced.length < 2;
  const showEmpty = !showHint && !searchQ.isFetching && results.length === 0;

  const label = useMemo(() => {
    if (selected) return formatLabel(selected);
    if (value && initialLabel) return initialLabel;
    return null;
  }, [selected, value, initialLabel]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setTimeout(() => inputRef.current?.focus(), 30);
        else {
          setInput("");
          setDebounced("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !label && "text-muted-foreground")}
        >
          <span className="flex items-center gap-2 truncate">
            <StoreIcon className="h-4 w-4 opacity-60 shrink-0" />
            <span className="truncate">{label ?? placeholder}</span>
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
            placeholder="Nome, rede ou UF…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput("")}
              className="text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Limpar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {searchQ.isFetching && (
            <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60 shrink-0" />
          )}
        </div>

        <div className="overflow-y-auto overscroll-contain p-1" style={{ maxHeight: 320 }}>
          {showHint && (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">
              Digite pelo menos 2 caracteres para pesquisar.
            </p>
          )}
          {showEmpty && (
            <p className="px-3 py-6 text-xs text-muted-foreground text-center">
              Nenhuma loja encontrada.
            </p>
          )}
          {results.map((s) => {
            const isActive = s.id === value;
            const cityUf = [s.city, s.uf].filter(Boolean).join(" - ");
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelected(s);
                  qc.setQueryData(["mk9-store", s.id], s);
                  onChange(s);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2.5 my-0.5 rounded-lg transition-colors",
                  "hover:bg-accent focus:bg-accent focus:outline-none",
                  isActive && "bg-accent",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium leading-tight truncate">{s.name}</p>
                    {cityUf && <p className="text-xs text-muted-foreground truncate">{cityUf}</p>}
                    {s.chain && (
                      <p className="text-xs text-muted-foreground truncate">Rede {s.chain}</p>
                    )}
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                </div>
              </button>
            );
          })}
        </div>

        {!showHint && results.length > 0 && total > results.length && (
          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground text-center bg-muted/30">
            Exibindo {results.length} de {total} resultados. Refine a busca para ver mais.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function formatLabel(s: StoreOption): string {
  const bits = [s.name];
  if (s.uf) bits.push(`· ${s.uf}`);
  if (s.chain) bits.push(`· ${s.chain}`);
  return bits.join(" ");
}
