import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/roteiros/")({
  loader: async ({ search }) => {
    // Se não houver promoterId na busca, redireciona para o painel principal (Command Center)
    if (!search.promoterId) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  // O componente agora renderiza o editor clássico se houver promoterId, 
  // mas o Command Center centralizou a visão geral.
  component: () => {
    // Como a Missão 6E transformou o dashboard na central, 
    // manteremos o redirecionamento aqui para o painel geral.
    throw redirect({
      to: "/dashboard",
    });
  }
});
