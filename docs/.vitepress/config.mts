import { defineConfig } from 'vitepress'
import { githubLinks, repository } from './github_links.mjs'

export default defineConfig({
  title: 'Masquerade',
  description: 'Server-side account masquerade for AdonisJS',
  base: '/oss-adonisjs-masquerade/',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['maintainers/**', 'design/**'],
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
      { text: 'Get started', link: '/guide/getting-started' },
      { text: 'API reference', link: '/api-reference' },
    ],
    sidebar: [
      {
        text: 'Get started',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Add masquerade', link: '/guide/walkthrough' },
          { text: 'Install and configure', link: '/guide/setup' },
          { text: 'Account Kit integration preview', link: '/guide/account-kit' },
          { text: 'Opaque access tokens', link: '/guide/access-tokens' },
          { text: 'Use a support mode', link: '/guide/usage' },
        ],
      },
      {
        text: 'Delivered clients',
        items: [
          { text: 'Edge forms', link: '/guide/usage#edge-forms-and-host-redirects' },
          { text: 'Session JSON client', link: '/guide/clients/json' },
          { text: 'Inertia React', link: '/guide/clients/react' },
          { text: 'Inertia Vue', link: '/guide/clients/vue' },
        ],
      },
      {
        text: 'Troubleshooting',
        items: [{ text: 'Troubleshooting', link: '/guide/troubleshooting' }],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Security and operations', link: '/guide/security' },
          { text: 'Route coverage review', link: '/guide/route-report' },
          { text: 'Custom authorities', link: '/guide/custom-authorities' },
          { text: 'Custom stores', link: '/guide/custom-stores' },
          { text: 'Pruning and retention', link: '/guide/operations' },
          { text: 'Notes for code agents', link: '/guide/agents' },
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
