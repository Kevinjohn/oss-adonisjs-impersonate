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
    nav: [{ text: 'API', link: '/api/' }],
    sidebar: [{ text: 'Reference', items: [{ text: 'API', link: '/api/' }] }],
  },
})
