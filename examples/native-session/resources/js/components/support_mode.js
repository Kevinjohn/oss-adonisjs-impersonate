/** A rendered customer intent is never silently rebuilt from a later status token. */
export function initSupportMode({
  documentRef = document,
  windowRef = window,
  fetchStatus = fetch,
  now = Date.now,
  schedule = setTimeout,
} = {}) {
  const root = documentRef.querySelector('[data-support-mode]')
  if (!root) return

  const deadline = Date.parse(root.dataset.expiresAt)
  const token = root.dataset.contextToken
  const notice = root.querySelector('[data-mode-notice]')
  let stale = false

  function freeze(message) {
    if (stale) return
    stale = true
    root.querySelector('[data-mode-label]').textContent = 'Support status needs checking'
    const badge = root.querySelector('[data-mode-badge]')
    badge.textContent = 'Check status'
    badge.classList.remove('support-badge--active')
    root.classList.remove('support-mode')
    notice.hidden = false
    notice.textContent = message
    for (const intent of documentRef.querySelectorAll('[data-support-intent]')) {
      intent.hidden = true
      for (const control of intent.querySelectorAll('button, input, select, textarea')) {
        control.disabled = true
      }
    }
  }

  function checkDeadline() {
    if (now() >= deadline) {
      freeze(
        'The fixed deadline has passed. Check current status before making another customer change.'
      )
    }
  }

  checkDeadline()
  if (!stale) schedule(checkDeadline, Math.max(0, deadline - now()))

  async function checkOnReturn() {
    if (documentRef.visibilityState !== 'visible' || stale) return
    checkDeadline()
    if (stale) return
    freeze('Checking support status. Use the status link before making another customer change.')
    try {
      const response = await fetchStatus('/masquerade', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!response.ok) throw new Error('Status unavailable')
      const mode = await response.json()
      if (!mode.isMasquerading || mode.contextToken !== token) {
        notice.textContent =
          'Support mode changed in another tab or session. Check current status before making another customer change.'
      } else {
        // Raw status cannot prove current customer eligibility. Rebuild business intent explicitly.
        notice.textContent =
          'Support mode may have changed while this page was away. Check current status, then reopen the customer page.'
      }
    } catch {
      notice.textContent =
        'Support status could not be checked. Use the status link before making another customer change.'
    }
  }

  documentRef.addEventListener('visibilitychange', checkOnReturn)
  windowRef.addEventListener('pageshow', (event) => {
    if (event.persisted) checkOnReturn()
  })
}
