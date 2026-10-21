import './css/app.css'
import { createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import Layout from '~/layouts/default'
import type { ReactElement } from 'react'

createInertiaApp({
  title: (title) => title ? `${title} — Support example` : 'Support example',
  resolve: (name) => resolvePageComponent(
    `./pages/${name}.tsx`,
    import.meta.glob('./pages/**/*.tsx'),
    (page: ReactElement) => <Layout>{page}</Layout>
  ),
  setup({ el, App, props }) { createRoot(el).render(<App {...props} />) },
  progress: { color: '#173b62' },
})
