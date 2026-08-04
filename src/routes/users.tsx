import { createFileRoute, redirect } from '@tanstack/react-router'
import { mk9CurrentUser } from '@/lib/mk9-users.functions'
import { createServerFn } from '@tanstack/react-start'

const checkAdmin = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const user = await mk9CurrentUser()
    return user?.roles.includes('ADMIN') || false
  } catch {
    return false
  }
})

export const Route = createFileRoute('/users')({
  beforeLoad: async () => {
    const isAdmin = await checkAdmin()
    if (!isAdmin) {
      throw redirect({ to: '/' })
    }
  },
})
