import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/roteiros/')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  }
})
