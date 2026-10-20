import Alpine from 'alpinejs'
import alertData from './components/alert.js'
import themeToggleData from './components/theme_toggle.js'
import { initSupportMode } from './components/support_mode.js'

Alpine.data('alert', alertData)
Alpine.data('themeToggle', themeToggleData)

Alpine.start()

document.getElementById('support-error-title')?.focus()
initSupportMode()
