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
  themeConfig: {
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: repository }],
    editLink: { pattern: `${repository}/edit/main/docs/:path` },
    nav: [
      { text: 'Guide', link: '/guide/setup' },
      { text: 'API', link: '/api/' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Install and configure', link: '/guide/setup' },
          { text: 'Security and operations', link: '/guide/security' },
        ],
      },
      { text: 'Reference', items: [{ text: 'API', link: '/api/' }] },
    ],
  },
})
