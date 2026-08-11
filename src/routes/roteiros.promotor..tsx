import { createFileRoute } from '@tanstack/react-router'
import { PromoterIndividualRoute } from '@/components/mk9/promoter-individual-route'
import { z } from 'zod'

export const Route = createFileRoute('/roteiros/promotor/')({
  component: PromoterIndividualRoute,
  validateSearch: (search) => z.object({
    date: z.string().optional(),
  }).parse(search),
})
