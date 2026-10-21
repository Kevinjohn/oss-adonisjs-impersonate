import { test } from '@japa/runner'
import { mock } from 'node:test'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import { demoAccounts, resetDemoAccounts, seedDemoAccounts } from '#services/demo_accounts'
import { setMasqueradeStoreUnavailable } from '#services/masquerade_test_boundary'

test.group('Inertia Vue browser journey', (group) => {
  group.setup(async () => {
    await testUtils.db().migrate()
    await resetDemoAccounts()
    await seedDemoAccounts()
  })
  group.each.setup(async () => {
    setMasqueradeStoreUnavailable(false)
    await resetDemoAccounts()
    await seedDemoAccounts()
  })
  group.each.teardown(async () => {
    setMasqueradeStoreUnavailable(false)
    await resetDemoAccounts()
  })

  test('completes support work, denies sensitive action, clears history, and restores focus', async ({
    browserContext,
    assert,
  }) => {
    const page = await browserContext.newPage()
    await signIn(page)
    const idleToken = await page.locator('input[name="_masqueradeContext"]').inputValue()
    assert.isTrue(idleToken.length > 20)
    await selectCustomer(page, 1)
    await page.getByLabel('Reason for support').fill('Customer requested help')
    await page.getByRole('button', { name: 'Start support mode' }).press('Enter')
    await page.waitForURL('**/support/customer')
    await page.getByRole('status').waitFor()
    assert.include(await page.getByRole('status').innerText(), 'Demo Operator')
    assert.include(await page.getByRole('status').innerText(), 'Customer One')
    assert.include(await page.getByRole('status').innerText(), 'all devices')
    assert.equal(await page.locator('input[name="_masqueradeContext"]').count(), 2)
    assert.equal(await page.locator('[data-identity="current"]').count(), 1)

    await page.setViewportSize({ width: 320, height: 760 })
    assert.isTrue(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    await page.getByLabel('Email updates').selectOption('1')
    await page.getByRole('button', { name: 'Save preference' }).press('Enter')
    await page.getByText('Customer email preference saved.').waitFor()
    await page.reload()
    await page.getByText('On', { exact: true }).waitFor()

    await page.getByRole('button', { name: 'Try sensitive account action' }).press('Enter')
    await page.waitForURL('**/support/recovery')
    await page.getByRole('heading', { name: 'Support action needs review' }).waitFor()
    assert.equal(await page.evaluate('document.activeElement?.tagName'), 'H1')
    await page.getByRole('link', { name: 'Check current status' }).click()
    await page.getByRole('button', { name: 'Stop support mode' }).waitFor()
    await page.getByRole('button', { name: 'Stop support mode' }).press('Enter')
    await page.getByRole('button', { name: 'Start support mode' }).waitFor()
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL('**/login')
  })

  test('rejects retained forms across tabs and redirects old Back history to current customer B', async ({
    browser,
    browserContext,
    assert,
  }) => {
    const current = await browserContext.newPage()
    await signIn(current)
    const staleTab = await browserContext.newPage()
    await staleTab.goto(`${base()}/support`)
    const oldIdleToken = await staleTab.locator('input[name="_masqueradeContext"]').inputValue()
    await selectCustomer(staleTab, 1)
    await staleTab.getByLabel('Reason for support').fill('Old idle intent')

    await selectCustomer(current, 1)
    await current.getByLabel('Reason for support').fill('Customer A request')
    await current.getByRole('button', { name: 'Start support mode' }).click()
    await current.waitForURL('**/support/customer')
    const tokenA = await current.locator('input[name="_masqueradeContext"]').first().inputValue()
    assert.notEqual(tokenA, oldIdleToken)

    const secondContext = await browser.newContext()
    try {
      const second = await secondContext.newPage()
      await signIn(second)
      await second.getByRole('button', { name: 'Stop support mode' }).click()
      await selectCustomer(second, 2)
      await second.getByLabel('Reason for support').fill('Customer B request')
      await second.getByRole('button', { name: 'Start support mode' }).click()
      await second.waitForURL('**/support/customer')

      await staleTab.getByRole('button', { name: 'Start support mode' }).click()
      await staleTab.waitForURL('**/support/recovery')
      await staleTab.getByRole('link', { name: 'Check current status' }).click()
      await staleTab.getByText(/viewing Customer Two/).waitFor()
      assert.notInclude(await staleTab.locator('main').innerText(), 'customer-one@example.test')

      await current.goBack()
      await current.getByRole('heading', { name: 'Support workspace' }).waitFor()
      assert.notInclude(await current.locator('main').innerText(), 'customer-one@example.test')
      await current.goForward()
      await current.waitForURL('**/support')
      assert.include(await current.locator('main').innerText(), 'Customer Two')
    } finally {
      await secondContext.close()
    }
  })

  test('hides a delayed customer A response and freezes the page at its fixed deadline', async ({
    browser,
    browserContext,
    assert,
  }) => {
    const first = await browserContext.newPage()
    await signIn(first)
    await selectCustomer(first, 1)
    await first.getByLabel('Reason for support').fill('Customer A request')
    await first.getByRole('button', { name: 'Start support mode' }).click()
    await first.waitForURL('**/support/customer')
    await first.getByRole('link', { name: 'Return to operator workspace' }).click()
    await first.waitForURL('**/support')

    const secondContext = await browser.newContext()
    try {
      const second = await secondContext.newPage()
      await signIn(second)
      await second.getByRole('button', { name: 'Stop support mode' }).click()
      await selectCustomer(second, 2)
      await second.getByLabel('Reason for support').fill('Customer B request')
      await second.getByRole('button', { name: 'Start support mode' }).click()
      await second.waitForURL('**/support/customer')

      const requestStarted = first.waitForRequest((request) =>
        request.url().includes('/support/customer?delayMs=')
      )
      const oldVisit = first.goto(`${base()}/support/customer?delayMs=1200`)
      await requestStarted
      await oldVisit
      await first.waitForURL('**/support')
      assert.notInclude(await first.locator('main').innerText(), 'customer-one@example.test')
      assert.include(await first.locator('main').innerText(), 'Customer Two')
    } finally {
      await secondContext.close()
    }

    const deadlineContext = await browser.newContext()
    const deadlinePage = await deadlineContext.newPage()
    const now = Date.now()
    mock.timers.enable({ apis: ['Date'], now })
    await deadlinePage.clock.install({ time: now })
    try {
      await signIn(deadlinePage)
      await selectCustomer(deadlinePage, 1)
      await deadlinePage.getByLabel('Reason for support').fill('Deadline check')
      await deadlinePage.getByRole('button', { name: 'Start support mode' }).click()
      await deadlinePage.waitForURL('**/support/customer')
      const deadline = Date.parse((await deadlinePage.locator('time').getAttribute('datetime'))!)
      mock.timers.setTime(deadline + 1)
      await deadlinePage.clock.runFor(deadline - now + 1)
      await deadlinePage.waitForURL('**/support')
      assert.notInclude(await deadlinePage.locator('main').innerText(), 'customer-one@example.test')
      assert.equal(await deadlinePage.getByRole('button', { name: 'Save preference' }).count(), 0)
    } finally {
      mock.timers.reset()
      await deadlineContext.close()
    }
  })

  test('renders raw stop and recovery when customer admission fails or storage is unavailable', async ({
    browserContext,
    assert,
  }) => {
    const page = await browserContext.newPage()
    await signIn(page)
    await selectCustomer(page, 1)
    await page.getByLabel('Reason for support').fill('Recovery test')
    await page.getByRole('button', { name: 'Start support mode' }).click()
    await page.waitForURL('**/support/customer')
    const target = await User.findByOrFail('email', demoAccounts[1].email)
    target.active = false
    await target.save()
    await page.goto(`${base()}/support/customer`)
    await page.waitForURL('**/support/recovery')
    await page.getByRole('link', { name: 'Check current status' }).click()
    await page.getByRole('button', { name: 'Stop support mode' }).waitFor()
    assert.include(await page.locator('main').innerText(), 'no longer available')

    setMasqueradeStoreUnavailable(true)
    await page.goto(`${base()}/support`)
    await page.waitForURL('**/support/recovery')
    assert.equal(await page.evaluate('document.activeElement?.tagName'), 'H1')
    setMasqueradeStoreUnavailable(false)
    await page.getByRole('link', { name: 'Check current status' }).click()
    await page.getByRole('button', { name: 'Stop support mode' }).waitFor()
  })
})

async function signIn(page: any) {
  await page.goto(`${base()}/login`)
  await page.getByLabel('Email').fill('operator@example.test')
  await page.getByLabel('Password').fill('demo-operator-2026')
  await page.getByRole('button', { name: 'Sign in' }).press('Enter')
  await page.waitForURL('**/support')
}

async function selectCustomer(page: any, index: number) {
  const customer = await User.findByOrFail('email', demoAccounts[index].email)
  await page.getByLabel('Customer').selectOption({ value: String(customer.id) })
}

function base() {
  const host = process.env.HOST ?? '127.0.0.1'
  const port = process.env.PORT ?? '3378'
  return `http://${host}:${port}`
}
