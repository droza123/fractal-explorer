import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { fit: 'contain', background: '#030712' },
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { fit: 'contain', background: '#030712' },
    },
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[64, 'favicon.ico']],
      padding: 0,
    },
  },
  images: ['public/fractal-icon.svg'],
})
