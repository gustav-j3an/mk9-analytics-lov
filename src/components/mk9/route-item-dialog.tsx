import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Search } from "lucide-react";
import { mk9RoutesUpsertItem } from "@/lib/mk9-routes.functions";
import { Mk9StoreAutocomplete } from "./store-autocomplete";

interface Props {
  open: boolean;
  onClose: () => void;
  promoters: any[];
  industries: any[];
  item?: any; // Para edição
}

export function RouteItemDialog({ open, onClose, promoters, industries, item }: Props) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(mk9RoutesUpsertItem);

  const [promoterId, setPromoterId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [industrySearch, setIndustrySearch] = useState("");

  useEffect(() => {
    if (item) {
      setPromoterId(item.promoterId || "");
      setStoreId(item.storeId || "");
      setSelectedIndustries([item.industryId]);
      setWeekdays([item.weekday]);
      setValidFrom(item.validFrom || new Date().toISOString().slice(0, 10));
    } else {
      setPromoterId("");
      setStoreId("");
      setSelectedIndustries([]);
      setWeekdays([]);
      setValidFrom(new Date().toISOString().slice(0, 10));
    }
    setIndustrySearch("");
  }, [item, open]);

  const mut = useMutation({
    mutationFn: async () => {
      // Regra da Missão 8A.1 Parte 4 e 5:
      // Salvar cada combinação (Promotor + Loja + Indústria + Dia) como um registro individual.
      // Iterar sobre indústrias e dias selecionados.
      for (const industryId of selectedIndustries) {
        for (const wd of weekdays) {
          await upsertFn({
            data: {
              id: item?.id, // ID só é enviado se for edição (o que limita a 1 indústria/dia no contrato atual de edição)
              promoterId,
              storeId,
              industryId,
              weekday: wd,
              validFrom
            }
          });
        }
      }
    },
    onSuccess: () => {
      toast.success(item ? "Roteiro atualizado." : "Roteiro criado.");
      qc.invalidateQueries({ queryKey: ["mk9-planned-routes-list"] });
      onClose();
    },
    onError: (err: any) => {
      if (err.message?.includes("CONFLITO_VIGENCIA")) {
        try {
          const info = JSON.parse(err.message.split("::")[1]);
          toast.error(`Conflito: ${info.conflictPromoterName} já possui esta rota.`);
        } catch {
          toast.error("Conflito de vigência detectado.");
        }
      } else {
        toast.error(err.message || "Erro ao salvar roteiro.");
      }
    },
  });

  const WEEKDAYS_MAP = [
    { id: 1, label: "SEG" },
    { id: 2, label: "TER" },
    { id: 3, label: "QUA" },
    { id: 4, label: "QUI" },
    { id: 5, label: "SEX" },
    { id: 6, label: "SAB" },
    { id: 0, label: "DOM" },
  ];

  const filteredIndustries = industries.filter(i => 
    i.name.toLowerCase().includes(industrySearch.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const toggleIndustry = (id: string) => {
    if (item) {
      // Na edição, mantemos o comportamento de 1 indústria por vez para simplificar o versionamento do registro original
      setSelectedIndustries([id]);
    } else {
      setSelectedIndustries(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border-border text-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-mk9-accent-primary uppercase">
            {item ? "Editar Item" : "Novo Item de Roteiro"}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Planejamento de rotas e indústrias
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Promotor *
              </Label>
              <Select value={promoterId} onValueChange={setPromoterId} disabled={!!item}>
                <SelectTrigger className="bg-input/50 border-border h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {promoters.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Início da Vigência *
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="h-9 pl-10 bg-input/50 border-border"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Loja *
            </Label>
            <Mk9StoreAutocomplete 
              value={storeId} 
              onChange={(s) => setStoreId(s.id)} 
              initialLabel={item?.storeName}
              disabled={!!item}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Indústrias *
              </Label>
              {selectedIndustries.length > 0 && (
                <span className="text-[9px] font-black text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full">
                  {selectedIndustries.length} selecionada{selectedIndustries.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            
            <div className="border border-border rounded-lg overflow-hidden bg-background/30">
              <div className="p-2 border-b border-border flex items-center gap-2 bg-muted/20">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input 
                  placeholder="Pesquisar indústrias..."
                  value={industrySearch}
                  onChange={(e) => setIndustrySearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs flex-1 placeholder:text-muted-foreground/50"
                />
              </div>
              <ScrollArea className="h-32">
                <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {filteredIndustries.map((ind) => (
                    <div 
                      key={ind.id} 
                      className={cn(
                        "flex items-center gap-2 p-1.5 rounded-md transition-colors cursor-pointer",
                        selectedIndustries.includes(ind.id) ? "bg-primary/10 border border-primary/20" : "hover:bg-accent border border-transparent"
                      )}
                      onClick={() => toggleIndustry(ind.id)}
                    >
                      <Checkbox 
                        id={`ind-${ind.id}`}
                        checked={selectedIndustries.includes(ind.id)}
                        onCheckedChange={() => toggleIndustry(ind.id)}
                        className="h-3.5 w-3.5"
                      />
                      <label 
                        htmlFor={`ind-${ind.id}`} 
                        className="text-[10px] font-bold uppercase truncate cursor-pointer"
                      >
                        {ind.name}
                      </label>
                    </div>
                  ))}
                  {filteredIndustries.length === 0 && (
                    <p className="col-span-2 text-[10px] text-center py-4 text-muted-foreground">
                      Nenhuma indústria encontrada.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Dias da Semana *
            </Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {WEEKDAYS_MAP.map((d) => (
                <div 
                  key={d.id} 
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer",
                    weekdays.includes(d.id) ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border/50 hover:border-border"
                  )}
                  onClick={() => {
                    if (item) return; // Na edição só permitimos o dia original
                    if (weekdays.includes(d.id)) setWeekdays(weekdays.filter(id => id !== d.id));
                    else setWeekdays([...weekdays, d.id]);
                  }}
                >
                  <Checkbox 
                    id={`day-${d.id}`}
                    checked={weekdays.includes(d.id)}
                    onCheckedChange={(checked) => {
                      if (item) return;
                      if (checked) setWeekdays([...weekdays, d.id]);
                      else setWeekdays(weekdays.filter(id => id !== d.id));
                    }}
                    disabled={!!item}
                    className="h-3.5 w-3.5"
                  />
                  <label htmlFor={`day-${d.id}`} className="text-[10px] font-black cursor-pointer select-none">{d.label}</label>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[9px] text-muted-foreground uppercase font-black text-center mt-2 italic bg-muted/10 py-1 rounded">
             {item ? "A versão anterior deste vínculo será encerrada em " + (new Date(new Date(validFrom).getTime() - 86400000).toLocaleDateString('pt-BR')) : "Novas rotas serão criadas a partir de " + (new Date(validFrom).toLocaleDateString('pt-BR'))}
          </p>
        </div>

        <DialogFooter className="mt-2 border-t border-border/50 pt-4">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground text-[10px] font-black" onClick={onClose}>
            CANCELAR
          </Button>
          <Button
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-foreground font-black px-8"
            onClick={() => mut.mutate()}
            disabled={!promoterId || !storeId || selectedIndustries.length === 0 || weekdays.length === 0 || mut.isPending}
          >
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (item ? "ATUALIZAR VÍNCULO" : "SALVAR ROTEIRO")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
