import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fractal-icon.svg', 'apple-touch-icon-180x180.png', 'og-image.jpg', 'favicon.ico'],
      manifest: {
        name: 'Fractal Voyager',
        short_name: 'Fractals',
        description: 'Explore Mandelbrot sets, Julia sets, and 3D Mandelbulb fractals with GPU-accelerated rendering, animation, and video export.',
        id: '/',
        start_url: '/',
        scope: '/',
        theme_color: '#7c3aed',
        background_color: '#030712',
        display: 'standalone',
        display_override: ['standalone', 'window-controls-overlay', 'minimal-ui'],
        orientation: 'any',
        dir: 'ltr',
        lang: 'en',
        categories: ['education', 'graphics', 'utilities'],
        prefer_related_applications: false,
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: 'screenshots/desktop-julia.jpg',
            sizes: '1920x1200',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Stunning Julia set fractals with infinite spiral detail and vibrant colors',
          },
          {
            src: 'screenshots/desktop-3d.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: '3D Mandelbulb visualization with ray-traced lighting and adjustable parameters',
          },
          {
            src: 'screenshots/desktop-mandelbrot.jpg',
            sizes: '1920x1200',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Classic Mandelbrot set with GPU-accelerated rendering and deep zoom capability',
          },
          {
            src: 'screenshots/desktop-heatmap.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Interactive heatmap explorer with AI-powered suggestions for interesting Julia sets',
          },
          {
            src: 'screenshots/animations-with-keyframes.jpg',
            sizes: '898x824',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Create smooth zoom animations with keyframe editor and customizable easing',
          },
          {
            src: 'screenshots/export-video.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Export animations as MP4 video up to 4K at 60fps',
          },
          {
            src: 'screenshots/saved-julia-sets.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Save and organize your favorite Julia sets with thumbnail previews',
          },
          {
            src: 'screenshots/export-images.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Export high-resolution images up to 8K in PNG, JPEG, or WebP format',
          },
          {
            src: 'screenshots/color-palette.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Choose from 18 stunning color palettes with temperature adjustment',
          },
          {
            src: 'screenshots/custom-palette.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Design your own custom color palettes with full color control',
          },
          {
            src: 'screenshots/equations.jpg',
            sizes: '1920x1080',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Explore 57 different fractal equations from classic to exotic formulas',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['screenshots/**/*'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    // Required headers for SharedArrayBuffer support (WebCodecs)
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // Also add headers for preview server
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
