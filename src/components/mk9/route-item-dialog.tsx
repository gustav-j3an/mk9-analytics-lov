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
import { Loader2, Calendar } from "lucide-react";
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
  const [industryId, setIndustryId] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (item) {
      setPromoterId(item.promoterId || "");
      setStoreId(item.storeId || "");
      setIndustryId(item.industryId || "");
      setWeekdays([item.weekday]);
      setValidFrom(item.validFrom || new Date().toISOString().slice(0, 10));
    } else {
      setPromoterId("");
      setStoreId("");
      setIndustryId("");
      setWeekdays([]);
      setValidFrom(new Date().toISOString().slice(0, 10));
    }
  }, [item, open]);

  const mut = useMutation({
    mutationFn: async () => {
      // Como o backend aceita um dia por vez no UpsertItem, se múltiplos dias foram selecionados na criação, 
      // precisamos iterar. Para simplicidade e aderência ao contrato versionado:
      for (const wd of weekdays) {
        await upsertFn({
          data: {
            id: item?.id, // Só envia ID se for edição de um registro específico
            promoterId,
            storeId,
            industryId,
            weekday: wd,
            validFrom
          }
        });
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-popover border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-mk9-accent-primary uppercase">
            {item ? "Editar Item" : "Novo Item de Roteiro"}
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Vínculo entre promotor, loja e indústria
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Promotor *
            </Label>
            <Select value={promoterId} onValueChange={setPromoterId}>
              <SelectTrigger className="bg-input/50 border-border">
                <SelectValue placeholder="Selecione o promotor..." />
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
              Loja *
            </Label>
            <Mk9StoreAutocomplete 
              value={storeId} 
              onChange={(s) => setStoreId(s.id)} 
              initialLabel={item?.storeName}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Indústria *
            </Label>
            <Select value={industryId} onValueChange={setIndustryId}>
              <SelectTrigger className="bg-input/50 border-border">
                <SelectValue placeholder="Selecione a indústria..." />
              </SelectTrigger>
              <SelectContent>
                {industries.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">
              Dias da Semana *
            </Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {WEEKDAYS_MAP.map((d) => (
                <div key={d.id} className="flex items-center gap-1.5 bg-muted/30 px-2 py-1.5 rounded-lg border border-border/50">
                  <Checkbox 
                    id={`day-${d.id}`}
                    checked={weekdays.includes(d.id)}
                    onCheckedChange={(checked) => {
                      if (item) {
                        // Na edição, só permitimos 1 dia (o atual)
                        setWeekdays([d.id]);
                      } else {
                        if (checked) setWeekdays([...weekdays, d.id]);
                        else setWeekdays(weekdays.filter(id => id !== d.id));
                      }
                    }}
                  />
                  <label htmlFor={`day-${d.id}`} className="text-[10px] font-black cursor-pointer">{d.label}</label>
                </div>
              ))}
            </div>
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
                className="pl-10 bg-input/50 border-border"
              />
            </div>
            <p className="text-[9px] text-muted-foreground uppercase font-medium mt-1 ml-1">
              {item ? "A versão anterior será encerrada um dia antes." : "Data a partir da qual o roteiro é válido."}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4 border-t border-border/50 pt-4">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            CANCELAR
          </Button>
          <Button
            className="bg-mk9-accent-primary hover:bg-mk9-accent-primary/90 text-foreground font-bold"
            onClick={() => mut.mutate()}
            disabled={!promoterId || !storeId || !industryId || weekdays.length === 0 || mut.isPending}
          >
            {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "SALVAR ROTEIRO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
