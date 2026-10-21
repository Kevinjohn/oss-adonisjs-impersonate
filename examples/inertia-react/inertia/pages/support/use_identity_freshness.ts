import { router } from '@inertiajs/react'
import { useEffect, useState } from 'react'

/** Freeze old page data immediately on restoration and fetch raw current status. */
export function useIdentityFreshness(expiresAt?: string) {
  const [stale, setStale] = useState(false)
  useEffect(() => {
    sessionStorage.setItem('supportHistorySeen', 'true')
    let timer: ReturnType<typeof setTimeout> | undefined
    let recovering = false
    const recover = () => {
      if (recovering) return
      recovering = true
      setStale(true)
      document.documentElement.dataset.identityPending = 'true'
      router.cancelAll()
      window.location.replace('/support')
    }
    document.addEventListener('visibilitychange', onVisibility)
    function onVisibility() {
      if (!document.hidden) recover()
    }
    if (expiresAt) {
      const remaining = Date.parse(expiresAt) - Date.now()
      if (remaining <= 0) recover()
      else timer = setTimeout(recover, remaining)
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer) clearTimeout(timer)
    }
  }, [expiresAt])
  return stale
}
