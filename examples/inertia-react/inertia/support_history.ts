/** Keep history restoration guarded even while a non-support page is mounted. */
export function installSupportHistoryRecovery() {
  const recover = () => {
    if (sessionStorage.getItem('supportHistorySeen') !== 'true') return
    document.documentElement.dataset.identityPending = 'true'
    window.location.replace('/support')
  }
  window.addEventListener('popstate', recover)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) recover()
  })
}
