import { defineConfig } from '@adonisjs/inertia'

const inertiaConfig = defineConfig({
  encryptHistory: true,
  ssr: {
    enabled: false,
    entrypoint: 'inertia/ssr.tsx',
  },
})

export default inertiaConfig
