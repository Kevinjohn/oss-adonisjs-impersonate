import { router } from '@inertiajs/vue3'

const visitedKey = 'support-page-visited'

/** Keep encrypted support pages from resurfacing through restored browser history. */
export function installSupportHistoryRecovery() {
  if (typeof window === 'undefined') return
  let redirecting = false
  router.on('navigate', (event) => {
    if (event.detail.page.url.startsWith('/support/customer')) {
      sessionStorage.setItem(visitedKey, 'true')
    }
  })
  window.addEventListener('popstate', () => {
    if (
      !sessionStorage.getItem(visitedKey) ||
      window.location.pathname === '/support' ||
      redirecting
    )
      return
    redirecting = true
    router.visit('/support', {
      replace: true,
      onFinish: () => {
        redirecting = false
      },
    })
  })
  window.addEventListener('pageshow', (event) => {
    if (
      event.persisted &&
      sessionStorage.getItem(visitedKey) &&
      window.location.pathname !== '/support'
    ) {
      router.visit('/support', { replace: true })
    }
  })
}
