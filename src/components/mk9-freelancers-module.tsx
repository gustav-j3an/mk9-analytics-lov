import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFreelancers, toggleFreelancerStatus } from "@/lib/mk9-freelancers.functions";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Power, Loader2 } from "lucide-react";
import { FreelancerAdminDialog } from "@/components/mk9/freelancer-admin-dialogs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function Mk9FreelancersModule() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const listFn = useServerFn(listFreelancers);
  const toggleFn = useServerFn(toggleFreelancerStatus);

  const { data: freelancers, isLoading, refetch } = useQuery({
    queryKey: ["mk9-freelancers"],
    queryFn: () => listFn({ data: { includeInactive: true } })
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string, active: boolean }) => toggleFn({ data: { id, active } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mk9-freelancers"] });
      toast.success("Status atualizado");
    }
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" /> Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestão de Freelancers</h2>
          <p className="text-slate-400">Cadastre e gerencie freelancers para atendimento avulso.</p>
        </div>
        <Button className="bg-command-purple hover:bg-command-purple/80" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Freelancer
        </Button>
      </div>

      <div className="border border-white/10 rounded-lg bg-[#111122]">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-slate-400">Nome</TableHead>
              <TableHead className="text-slate-400">Cidade/UF</TableHead>
              <TableHead className="text-slate-400">Telefone</TableHead>
              <TableHead className="text-slate-400">Vlr Padrão</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-right text-slate-400">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {freelancers?.map((f: any) => (
              <TableRow key={f.id} className="border-white/5 hover:bg-white/5">
                <TableCell className="text-white font-medium">{f.name}</TableCell>
                <TableCell className="text-slate-300">{f.city ? `${f.city}/${f.uf}` : "-"}</TableCell>
                <TableCell className="text-slate-300">{f.phone || "-"}</TableCell>
                <TableCell className="text-emerald-400 font-mono text-xs">
                  {f.default_daily_rate ? `R$ ${Number(f.default_daily_rate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "-"}
                </TableCell>
                <TableCell>
                  <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase", f.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                    {f.active ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(f); setOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => toggleMutation.mutate({ id: f.id, active: !f.active })}
                    className={f.active ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300"}
                  >
                    <Power className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {freelancers?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-xl bg-white/5 text-center">
          <Users className="w-12 h-12 text-slate-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Nenhum freelancer cadastrado</h3>
          <p className="text-slate-400 max-w-xs mb-6">Comece cadastrando um prestador para realizar diárias e atendimentos avulsos.</p>
          <Button className="bg-command-purple hover:bg-command-purple/80" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Cadastrar Primeiro Freelancer
          </Button>
        </div>
      )}

      <FreelancerAdminDialog open={open} onOpenChange={setOpen} freelancer={editing} />
    </div>
  );
}
