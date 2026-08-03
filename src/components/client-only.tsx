import * as React from 'react'

export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasHydrated, setHasHydrated] = React.useState(false)

  React.useEffect(() => {
    setHasHydrated(true)
  }, [])

  if (!hasHydrated) {
    return null
  }

  return <>{children}</>
}
