import { createFileRoute, redirect } from '@tanstack/react-router'
import { Mk9AnalyticsApp } from '@/components/mk9-analytics-app'
import { createServerFn } from '@tanstack/react-start'

const checkAdmin = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireMk9Role } = await import('@/lib/mk9-auth/require-role.server');
  try {
    await requireMk9Role(['ADMIN']);
    return true;
  } catch {
    return false;
  }
})

export const Route = createFileRoute('/users')({
  beforeLoad: async () => {
    const isAdmin = await checkAdmin()
    if (!isAdmin) {
      throw redirect({ to: '/' })
    }
  },
  component: () => <Mk9AnalyticsApp />
})
