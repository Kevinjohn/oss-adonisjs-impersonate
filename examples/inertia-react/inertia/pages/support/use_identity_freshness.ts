import { router } from '@inertiajs/react'
import { useEffect, useState } from 'react'

/** Freeze old page data immediately on restoration and fetch raw current status. */
export function useIdentityFreshness(expiresAt?: string) {
  const [stale, setStale] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const recover = () => {
      setStale(true)
      document.documentElement.dataset.identityPending = 'true'
      router.visit('/support', { replace: true, preserveState: false, preserveScroll: false })
    }
    window.addEventListener('popstate', recover)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibility)
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) recover()
    }
    function onVisibility() {
      if (!document.hidden) recover()
    }
    if (expiresAt) {
      const remaining = Date.parse(expiresAt) - Date.now()
      if (remaining <= 0) recover()
      else timer = setTimeout(recover, remaining)
    }
    document.documentElement.removeAttribute('data-identity-pending')
    return () => {
      window.removeEventListener('popstate', recover)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer) clearTimeout(timer)
    }
  }, [expiresAt])
  return stale
}
