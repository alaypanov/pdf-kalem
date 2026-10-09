import { defineConfig, presetWind4 } from 'unocss'

export default defineConfig({
  presets: [presetWind4()],
  theme: {
    colors: {
      // Paper — the docs brand palette (light).
      ink: '#1c1917',
      paper: '#faf9f7',
      paper2: '#f3f1ec',
      muted: '#78716c',
      faint: '#a8a29e',
      accent: '#b45309',
      hairline: 'rgba(28, 25, 23, 0.12)',
      // Night paper — docs dark mode; theme/custom.css flips the palette.
      night: '#1c1917',
      night2: '#211d1b',
      bone: '#e7e5e4',
      nightline: 'rgba(231, 229, 228, 0.12)',
    },
    fontFamily: {
      mono: "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace",
      serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
    },
  },
})
