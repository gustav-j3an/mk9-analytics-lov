import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/roteiros/')({
  beforeLoad: ({ search }) => {
    // Se vier com promoterId, redireciona para o dashboard com o módulo de roteiros ativo
    // (Note: No MK9AnalyticsApp, o módulo é controlado por estado interno, não por URL,
    // mas o redirecionamento para /dashboard garante que o usuário caia no shell correto)
    throw redirect({ 
      to: '/dashboard', 
      // search: { promoterId: (search as any).promoterId } // Opcional se quisermos passar o filtro
    })
  }
})
