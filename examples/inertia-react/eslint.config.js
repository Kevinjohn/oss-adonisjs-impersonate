import { configApp } from '@adonisjs/eslint-config'

export default [
  ...configApp(),
  {
    files: ['inertia/**/*.tsx'],
    rules: {
      // This example uses ordinary URL-based Inertia forms, without a generated route registry.
      '@adonisjs/prefer-adonisjs-inertia-form': 'off',
      '@adonisjs/prefer-adonisjs-inertia-link': 'off',
    },
  },
]
