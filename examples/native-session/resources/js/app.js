import Alpine from 'alpinejs'
import alertData from './components/alert.js'
import themeToggleData from './components/theme_toggle.js'

Alpine.data('alert', alertData)
Alpine.data('themeToggle', themeToggleData)

Alpine.start()
