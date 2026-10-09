import DefaultTheme from 'vitepress/theme'
import OpenLayout from './OpenLayout.vue'
import './custom.css'
import 'virtual:uno.css'

export default {
  extends: DefaultTheme,
  Layout: OpenLayout,
}