import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVisitEvidences, processVisitEvidence } from "@/lib/mk9-portal/validation.functions";
import { getEvidenceSignedUrl } from "@/lib/mk9-portal/evidence.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, CheckCircle, XCircle, MapPin, Loader2, Image as ImageIcon, AlertTriangle } from "lucide-react";

export function Mk9ValidationCenterModule() {
  const [status, setStatus] = useState("PENDING");
  const listEvidencesFn = useServerFn(listVisitEvidences);
  const processFn = useServerFn(processVisitEvidence);
  const getSignedUrlFn = useServerFn(getEvidenceSignedUrl);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["mk9-validation", status],
    queryFn: () => listEvidencesFn({ data: { status: status as any } }),
  });

  const mutation = useMutation({
    mutationFn: processFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mk9-validation"] });
      toast.success("Ação realizada com sucesso!");
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black uppercase tracking-tight">Validação de Visitas</h2>
        <Badge variant="secondary" className="text-lg">{data?.count ?? 0} Pendentes</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10" /></div>
      ) : (data?.evidences.length === 0 ? (
        <p className="text-center text-muted-foreground p-20">Nenhuma visita aguardando validação.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.evidences.map((ev: any) => (
            <Card key={ev.id} className="border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm uppercase">{ev.store?.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{ev.promoter?.name} • {ev.industry?.name}</p>
                  </div>
                  {ev.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => mutation.mutate({ data: { evidenceId: ev.id, action: "APPROVE" } })}>
                        <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        const reason = prompt("Motivo da rejeição:");
                        if (reason) mutation.mutate({ data: { evidenceId: ev.id, action: "REJECT", rejectionReason: reason } });
                      }}>
                        <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                      </Button>
                    </div>
                  ) : <Badge>{ev.status}</Badge>}
                </div>
                
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {ev.location_status} • {ev.distance_from_store_meters}m
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
