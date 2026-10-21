import { test } from '@japa/runner'
import { mock } from 'node:test'
import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { resetDemoAccounts, seedDemoAccounts } from '#services/demo_accounts'
import {
  setMasqueradeStoreUnavailable,
  setMasqueradeTestTime,
} from '#services/masquerade_test_boundary'

const base = () => `http://${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? '3371'}`

test.group('React support browser journey', (group) => {
  group.setup(() => testUtils.db().migrate())
  group.each.setup(async () => {
    await resetDemoAccounts()
    await seedDemoAccounts()
  })
  group.each.teardown(async () => {
    setMasqueradeStoreUnavailable(false)
    setMasqueradeTestTime(undefined)
    await limiter.clear(['memory'])
    await resetDemoAccounts()
  })

  test('completes the keyboard journey and keeps controls usable at 320px', async ({
    browserContext,
    assert,
  }) => {
    const page = await browserContext.newPage()
    await page.goto(`${base()}/login`)
    await page.getByLabel('Email').fill('operator@example.test')
    await page.getByLabel('Password').fill('demo-operator-2026')
    await page.getByRole('button', { name: 'Log in' }).press('Enter')
    await page.waitForURL('**/support')
    await page.getByLabel('Customer').selectOption({ label: 'Customer One' })
    await page.getByLabel('Reason for support').fill('Customer requested email update help')
    await page.getByRole('button', { name: 'Start support mode' }).press('Enter')
    await page.waitForURL('**/support/customer')
    assert.include(await page.getByRole('status').first().innerText(), 'Customer One')
    assert.include(await page.locator('main').innerText(), 'customer-one@example.test')
    await page.setViewportSize({ width: 320, height: 844 })
    assert.isTrue(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    await page.getByLabel('Email updates').selectOption('1')
    await page.getByRole('button', { name: 'Save preference' }).press('Enter')
    await page.getByText('Customer email preference saved.').waitFor()
    await page.reload()
    assert.include(await page.locator('main').innerText(), 'On')
    await page.getByRole('button', { name: 'Try sensitive account action' }).press('Enter')
    await page.getByRole('heading', { name: 'Support action needs review' }).waitFor()
    assert.equal(await page.evaluate('document.activeElement?.tagName'), 'H1')
    await page.getByRole('link', { name: 'Check current status' }).click()
    await page.getByRole('button', { name: 'Stop support mode' }).click()
    await page.getByRole('button', { name: 'Start support mode' }).waitFor()
  })

  test('revalidates retained pages through A to B and independent operator sessions', async ({
    browser,
    browserContext,
    assert,
  }) => {
    const first = await browserContext.newPage()
    await signIn(first)
    const staleTab = await browserContext.newPage()
    await staleTab.goto(`${base()}/support`)
    const idleToken = await staleTab.locator('input[name="_masqueradeContext"]').inputValue()

    await first.getByLabel('Customer').selectOption({ label: 'Customer One' })
    await first.getByLabel('Reason for support').fill('Customer One requested help')
    await first.getByRole('button', { name: 'Start support mode' }).click()
    await first.waitForURL('**/support/customer')
    assert.include(await first.locator('main').innerText(), 'customer-one@example.test')
    const activeAToken = await first
      .locator('input[name="_masqueradeContext"]')
      .first()
      .inputValue()
    assert.notEqual(activeAToken, idleToken)

    const separate = await browser.newContext()
    try {
      const second = await separate.newPage()
      await signIn(second)
      await second.goto(`${base()}/support`)
      await second.getByRole('button', { name: 'Stop support mode' }).click()
      await second.getByRole('button', { name: 'Start support mode' }).waitFor()
      await second.getByLabel('Customer').selectOption({ label: 'Customer Two' })
      await second.getByLabel('Reason for support').fill('Customer Two requested help')
      await second.getByRole('button', { name: 'Start support mode' }).click()
      await second.waitForURL('**/support/customer')

      await staleTab.bringToFront()
      await staleTab.goto(`${base()}/support/customer`)
      assert.include(await staleTab.locator('main').innerText(), 'customer-two@example.test')
      assert.notInclude(await staleTab.locator('main').innerText(), 'customer-one@example.test')
      await staleTab.goBack()
      await staleTab.getByRole('heading', { name: 'Support workspace' }).waitFor()
      assert.notInclude(await staleTab.locator('main').innerText(), 'customer-one@example.test')
      await staleTab.goForward()
      assert.notInclude(await staleTab.locator('main').innerText(), 'customer-one@example.test')
    } finally {
      await separate.close()
    }
  })

  test('freezes the customer page at its exact deadline and renders unavailable recovery', async ({
    browserContext,
    assert,
  }) => {
    const now = Date.now()
    mock.timers.enable({ apis: ['Date'], now })
    try {
      const page = await browserContext.newPage()
      await page.clock.install({ time: now })
      await signIn(page)
      await page.getByLabel('Customer').selectOption({ label: 'Customer One' })
      await page.getByLabel('Reason for support').fill('Fixed deadline review')
      await page.getByRole('button', { name: 'Start support mode' }).click()
      await page.waitForURL('**/support/customer')
      const deadline = Date.parse((await page.locator('time').getAttribute('datetime'))!)
      await page.clock.setFixedTime(deadline)
      mock.timers.setTime(deadline)
      setMasqueradeTestTime(deadline)
      await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
      await page.getByRole('heading', { name: 'Support workspace' }).waitFor()
      assert.notInclude(await page.locator('main').innerText(), 'customer-one@example.test')
      assert.equal(await page.getByRole('button', { name: 'Save preference' }).count(), 0)
      setMasqueradeTestTime(undefined)
      mock.timers.setTime(now)
      await page.getByLabel('Customer').selectOption({ label: 'Customer One' })
      await page.getByLabel('Reason for support').fill('Recovery after expiry')
      await page.getByRole('button', { name: 'Start support mode' }).click()
      await page.waitForURL('**/support/customer')
      setMasqueradeStoreUnavailable(true)
      await page.goto(`${base()}/support`)
      await page.getByRole('heading', { name: 'Support action needs review' }).waitFor()
      assert.equal(await page.evaluate('document.activeElement?.tagName'), 'H1')
      assert.include(await page.locator('main').innerText(), 'Check raw status')
      setMasqueradeStoreUnavailable(false)
      await page.getByRole('link', { name: 'Check current status' }).click()
      await page.getByRole('button', { name: 'Stop support mode' }).waitFor()
    } finally {
      setMasqueradeTestTime(undefined)
      setMasqueradeStoreUnavailable(false)
      mock.timers.reset()
    }
  })

  test('discards a delayed A response after another tab moves to B', async ({
    browserContext,
    assert,
  }) => {
    const first = await browserContext.newPage()
    await signIn(first)
    await first.getByLabel('Customer').selectOption({ label: 'Customer One' })
    await first.getByLabel('Reason for support').fill('First customer')
    await first.getByRole('button', { name: 'Start support mode' }).click()
    await first.waitForURL('**/support/customer')
    await first.getByRole('link', { name: 'Return to operator workspace' }).click()
    await first.waitForURL('**/support')

    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let intercepted: (() => void) | undefined
    const sawRequest = new Promise<void>((resolve) => {
      intercepted = resolve
    })
    await first.route('**/support/customer', async (route) => {
      const response = await route.fetch()
      intercepted?.()
      await gate
      await route.fulfill({ response })
    })
    await first.getByRole('link', { name: 'Open customer view' }).click()
    await sawRequest

    const second = await browserContext.newPage()
    await second.goto(`${base()}/support`)
    await second.getByRole('button', { name: 'Stop support mode' }).click()
    await second.getByLabel('Customer').selectOption({ label: 'Customer Two' })
    await second.getByLabel('Reason for support').fill('Second customer')
    await second.getByRole('button', { name: 'Start support mode' }).click()
    await second.waitForURL('**/support/customer')
    await first.bringToFront()
    release?.()
    await first.getByRole('heading', { name: 'Support workspace' }).waitFor()
    assert.notInclude(await first.locator('main').innerText(), 'customer-one@example.test')
    await first.goto(`${base()}/support/customer`)
    assert.include(await first.locator('main').innerText(), 'customer-two@example.test')
  })

  test('recovers when the target becomes ineligible', async ({ browserContext, assert }) => {
    const page = await browserContext.newPage()
    await signIn(page)
    await page.getByLabel('Customer').selectOption({ label: 'Customer One' })
    await page.getByLabel('Reason for support').fill('Admission recovery')
    await page.getByRole('button', { name: 'Start support mode' }).click()
    await page.waitForURL('**/support/customer')
    const customer = await User.findByOrFail('email', 'customer-one@example.test')
    customer.active = false
    await customer.save()
    await page.goto(`${base()}/support/customer`)
    await page.getByRole('heading', { name: 'Support action needs review' }).waitFor()
    assert.notInclude(await page.locator('main').innerText(), 'customer-one@example.test')
    await page.getByRole('link', { name: 'Check current status' }).click()
    await page.getByRole('heading', { name: 'Support workspace' }).waitFor()
  })
})

async function signIn(
  page: Awaited<ReturnType<import('@japa/runner/core').TestContext['browserContext']['newPage']>>
) {
  await page.goto(`${base()}/login`)
  await page.getByLabel('Email').fill('operator@example.test')
  await page.getByLabel('Password').fill('demo-operator-2026')
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL('**/support')
}
