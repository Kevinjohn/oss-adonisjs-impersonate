/** Same-origin session example: each unsafe intent captures its own context and CSRF token. */
export function initJsonClient({
  documentRef = globalThis.document,
  fetchRef = globalThis.fetch,
  now = Date.now,
  schedule = setTimeout,
} = {}) {
  const root = documentRef?.getElementById('json-client')
  if (!root) return
  const el = (id) => documentRef.getElementById(id)
  const csrf = root.dataset.csrf
  let status = null
  let customer = null
  let generation = 0
  let frozen = false
  let rawStopAllowed = false
  let deadlineTimer

  function notice(message, focus = false) {
    const node = el('json-notice')
    node.textContent = message
    if (focus) node.focus()
  }
  function clearCustomer() {
    customer = null
    el('json-customer').textContent = ''
    el('json-preference').hidden = true
    el('json-setting').value = '0'
  }
  function freeze(message, { allowRawStop = false } = {}) {
    frozen = true
    rawStopAllowed = allowRawStop && Boolean(status?.isMasquerading)
    clearCustomer()
    el('json-preference').hidden = true
    el('json-sensitive').disabled = true
    el('json-stop').disabled = !rawStopAllowed
    notice(message, true)
  }
  async function request(path, { method = 'GET', body, token } = {}) {
    const headers = { Accept: 'application/json' }
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json'
      headers['X-CSRF-TOKEN'] = csrf
      headers['X-Masquerade-Context'] = token
    }
    const response = await fetchRef(path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const type = response.headers.get('content-type') || ''
    if (!type.includes('application/json')) {
      const error = new Error('The host returned a redirect or a non-JSON response.')
      error.status = [429, 503].includes(response.status) ? response.status : 419
      error.retryAfter = response.headers.get('retry-after')
      throw error
    }
    const data = await response.json()
    if (!response.ok) {
      const error = new Error(data?.message || `Request failed (${response.status}).`)
      error.status = response.status
      error.code = data?.code
      error.retryAfter = response.headers.get('retry-after')
      throw error
    }
    return data
  }
  function errorMessage(error) {
    if (error.status === 401 || error.status === 419)
      return 'Session or CSRF protection changed. Reload this page for a new token, sign in if needed, then check status.'
    if (error.status === 409 || error.status === 428)
      return 'Support context changed. Check current status and choose a new action.'
    if (error.status === 403)
      return 'This action is blocked or the current customer does not permit it.'
    if (error.status === 422) return `Check the submitted fields: ${error.message}`
    if (error.status === 429)
      return `Too many control attempts. Wait${error.retryAfter ? ` ${error.retryAfter} seconds` : ''}, then check status.`
    if (error.status === 503)
      return 'The last action may have completed. Check current status before choosing a new action.'
    return error.message || 'The request failed. Check current status.'
  }
  function renderStatus() {
    const active = Boolean(status?.isMasquerading)
    el('json-start-panel').hidden = active || frozen
    el('json-active-panel').hidden = !active
    el('json-mode').textContent = active
      ? `Stored customer ID: ${status.targetId}`
      : 'No support mode is active.'
    el('json-stop').disabled = !active || (frozen && !rawStopAllowed)
    el('json-sensitive').disabled = frozen || !customer
  }
  async function loadCustomer(expectedGeneration) {
    try {
      const data = await request('/support/json/customer')
      if (
        generation !== expectedGeneration ||
        !status?.isMasquerading ||
        data.mode.contextToken !== status.contextToken
      )
        return false
      if (now() >= Date.parse(data.mode.expiresAt)) {
        freeze(
          'The fixed deadline passed. Customer actions are closed; raw stop remains available.',
          { allowRawStop: true }
        )
        return false
      }
      customer = data
      el('json-customer').textContent =
        `${data.customer.fullName || data.customer.email} (${data.customer.email}) · email updates ${data.emailUpdates ? 'on' : 'off'}. Signed in as ${data.actor.email}.`
      el('json-setting').value = data.emailUpdates ? '1' : '0'
      el('json-preference').hidden = !data.canEdit
      el('json-sensitive').disabled = false
      el('json-deadline').textContent = `Fixed deadline: ${data.mode.expiresAt}`
      notice('Customer access confirmed. Choose a new action.')
      return true
    } catch (error) {
      if (generation !== expectedGeneration) return false
      clearCustomer()
      notice(errorMessage(error), true)
      return false
    }
  }
  async function refresh() {
    const current = ++generation
    clearTimeout(deadlineTimer)
    frozen = true
    rawStopAllowed = false
    clearCustomer()
    renderStatus()
    notice('Checking current status…')
    try {
      const next = await request('/masquerade')
      if (generation !== current) return false
      status = next
      el('json-start').reset()
      frozen = false
      if (next.isMasquerading && now() >= Date.parse(next.expiresAt)) {
        freeze(
          'The stored mode has expired. Customer actions are closed; raw stop remains available.',
          { allowRawStop: true }
        )
        renderStatus()
        return false
      }
      renderStatus()
      if (next.isMasquerading) {
        const delay = Math.max(0, Date.parse(next.expiresAt) - now())
        deadlineTimer = schedule(() => {
          if (generation === current)
            freeze(
              'The fixed deadline passed. Customer actions are closed; raw stop remains available.',
              { allowRawStop: true }
            )
        }, delay)
        return await loadCustomer(current)
      }
      notice('Support mode is idle. Choose a customer to start.')
      return true
    } catch (error) {
      if (generation !== current) return false
      status = null
      freeze(errorMessage(error))
      renderStatus()
      return false
    }
  }
  async function act(path, body, token) {
    if (
      (frozen && !(path === '/masquerade/stop' && rawStopAllowed)) ||
      !status ||
      token !== status.contextToken
    )
      return
    const current = ++generation
    frozen = true
    rawStopAllowed = false
    el('json-start').reset()
    clearCustomer()
    renderStatus()
    notice('Waiting for the result…')
    try {
      const result = await request(path, { method: 'POST', body, token })
      if (generation !== current) return
      // A response can arrive after another tab changes mode. Read raw status before rendering.
      const refreshed = await refresh()
      if (!refreshed || generation !== current + 1) return
      if (path.endsWith('/sensitive'))
        notice('Sensitive action was unexpectedly accepted; check status.', true)
      else if (result) notice('Action completed. Current status and customer data refreshed.')
    } catch (error) {
      if (generation !== current) return
      const message = errorMessage(error)
      await refresh()
      if (generation === current + 1) notice(message + ' The old action was not replayed.', true)
    }
  }
  el('json-refresh').addEventListener('click', refresh)
  el('json-start').addEventListener('submit', (event) => {
    event.preventDefault()
    if (frozen || !status || status.isMasquerading) return
    const token = status.contextToken
    act(
      '/masquerade/start',
      {
        targetId: el('json-target').value,
        reason: el('json-reason').value,
        access: documentRef.querySelector('input[name="json-access"]:checked')?.value ?? 'view',
      },
      token
    )
  })
  el('json-stop').addEventListener('click', () => {
    if (!status?.isMasquerading) return
    act('/masquerade/stop', {}, status.contextToken)
  })
  el('json-preference').addEventListener('submit', (event) => {
    event.preventDefault()
    if (!customer || frozen || now() >= Date.parse(customer.mode.expiresAt)) return
    const token = customer.mode.contextToken
    act('/support/json/customer/preference', { emailUpdates: el('json-setting').value }, token)
  })
  el('json-sensitive').addEventListener('click', () => {
    if (!customer || frozen) return
    act('/support/json/customer/sensitive', {}, customer.mode.contextToken)
  })
  documentRef.addEventListener('visibilitychange', () => {
    if (documentRef.visibilityState === 'visible') refresh()
  })
  refresh()
}

initJsonClient()
