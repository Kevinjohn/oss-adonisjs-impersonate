import { test } from '@japa/runner'
import edge from 'edge.js'

test('renders error pages inside the marketing layout', async ({ assert }) => {
  const pages = [
    {
      template: 'pages/errors/server_error',
      error: { code: 500 },
      message: 'The server hit an unexpected error.',
    },
    {
      template: 'pages/errors/not_found',
      error: { code: 404 },
      message: "That route hasn't been built yet.",
    },
  ]
  const renderer = edge.createRenderer().share({
    request: { plainCookie: () => 'light' },
    auth: { user: null },
    flashMessages: { has: () => false, get: () => undefined },
  })

  for (const page of pages) {
    const html = await renderer.render(page.template, { error: page.error })

    assert.notInclude(html, '@marketing')
    assert.isTrue(html.trimStart().startsWith('<!DOCTYPE html>'))
    assert.include(html, '<header class="header header--floating">')
    assert.include(html, page.message)
  }
})
