import { defineConfig } from 'vitepress'
import { githubLinks, repository } from './github_links.mjs'

export default defineConfig({
  title: 'Masquerade',
  description: 'Server-side account masquerade for AdonisJS',
  base: '/oss-adonisjs-impersonate/',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['maintainers/**'],
  rewrites: { 'README.md': 'index.md' },
  markdown: { config: githubLinks },
  transformPageData(pageData) {
    if (pageData.relativePath.startsWith('api/')) {
      pageData.frontmatter.editLink = false
    }
  },
  themeConfig: {
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: repository }],
    editLink: { pattern: `${repository}/edit/main/docs/:path` },
    nav: [
      { text: 'Guide', link: '/guide/setup' },
      { text: 'API reference', link: '/api-reference' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Install and configure', link: '/guide/setup' },
          { text: 'Use a support mode', link: '/guide/usage' },
          { text: 'Inertia Vue example', link: '/guide/clients/vue' },
          { text: 'Security and operations', link: '/guide/security' },
        ],
      },
      {
        text: 'API reference',
        items: [
          { text: 'Supported imports', link: '/api-reference' },
          {
            text: 'Core and authentication',
            collapsed: true,
            items: [
              { text: 'Configuration', link: '/api/index/functions/defineConfig' },
              { text: 'Core service', link: '/api/index/functions/createMasqueradeService' },
              {
                text: 'Effective session guard',
                link: '/api/auth/main/functions/effectiveSessionGuard',
              },
              {
                text: 'Native session authority',
                link: '/api/native/main/functions/sessionAuthority',
              },
              {
                text: 'Provider registration',
                link: '/api/providers/masquerade_provider/classes/default',
              },
              { text: 'Ace command loader', link: '/api/commands/main/functions/getMetaData' },
            ],
          },
          {
            text: 'HTTP and browser helpers',
            collapsed: true,
            items: [
              { text: 'Control controller', link: '/api/http/main/classes/MasqueradeController' },
              { text: 'Context middleware', link: '/api/http/main/functions/masqueradeContext' },
              { text: 'Sensitive route marker', link: '/api/http/main/functions/sensitive' },
              { text: 'Mutation route marker', link: '/api/http/main/functions/allowMutation' },
              { text: 'Context field helper', link: '/api/http/main/functions/contextField' },
              { text: 'Edge share helper', link: '/api/http/main/functions/shareMasquerade' },
              {
                text: 'Error rendering helper',
                link: '/api/http/main/functions/renderMasqueradeError',
              },
            ],
          },
          {
            text: 'Types and optional integrations',
            collapsed: true,
            items: [
              { text: 'ControlStore contract', link: '/api/src/types/interfaces/ControlStore' },
              {
                text: 'Native authority contract',
                link: '/api/src/types/interfaces/NativeAuthority',
              },
              { text: 'Optional Lucid store', link: '/api/stores/lucid/classes/LucidControlStore' },
              {
                text: 'Lucid schema helpers',
                link: '/api/stores/lucid/functions/createMasqueradeSchema',
              },
              { text: 'Memory test store', link: '/api/testing/main/classes/MemoryControlStore' },
              {
                text: 'Store conformance helper',
                link: '/api/testing/main/functions/assertControlStoreConformance',
              },
            ],
          },
        ],
      },
    ],
  },
})
