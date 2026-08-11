import { createFileRoute, redirect } from '@tanstack/react-router';
import { requireMk9RoleScope } from '@/lib/mk9-auth/read-guards.server';
import { Mk9PortalDashboard } from '@/components/mk9-portal-dashboard';

export const Route = createFileRoute('/mk9-portal')({
  beforeLoad: async () => {
    // Garante que apenas PROMOTOR (ou ADMIN/SUPERVISOR testando) acesse
    await requireMk9RoleScope(['PROMOTOR', 'ADMIN', 'SUPERVISOR'], undefined);
  },
  loader: async () => {
    const { scope } = await requireMk9RoleScope(['PROMOTOR', 'ADMIN', 'SUPERVISOR'], undefined);
    
    // Se for um PROMOTOR sem promoter_id vinculado no escopo, algo está errado
    if (scope.role === 'PROMOTOR' && (!scope.allowedPromoterIds || scope.allowedPromoterIds.length === 0)) {
       // Em produção, isso deve ser tratado ou o escopo deve extrair o vínculo user_id -> promoter_id
    }
    
    return { scope };
  },
  component: Mk9PortalDashboard,
  head: () => ({
    title: "MK9 | Portal do Promotor",
    meta: [
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" },
      { name: "description", content: "Área exclusiva do promotor MK9" }
    ]
  })
});
