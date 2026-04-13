import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') {
    return '/'
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return '/'
  }
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`
}

export default defineConfig({
  base: normalizeBasePath(process.env.LISTENTROPY_BASE_PATH),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Warnings above this size are expected to be enforced by perf budget gates in CI.
    // Keep this synchronized with scripts/perf/budgets.json and revisit on Vite major upgrades.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('recharts')) {
              return 'vendor-recharts'
            }
            if (id.includes('@react-three') || id.includes('/three/')) {
              return 'vendor-three'
            }
            if (id.includes('d3-force')) {
              return 'vendor-d3'
            }
            if (id.includes('jszip') || id.includes('html-to-image')) {
              return 'vendor-share'
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-radix'
            }
            return undefined
          }
          if (id.includes('/src/components/views/')) {
            return 'views'
          }
          return undefined
        },
      },
    },
  },
  server: {
    port: 5000,
    host: '0.0.0.0',
    open: false,
    allowedHosts: true,
    watch: {
      ignored: ['**/coverage/**', '**/playwright-report/**', '**/test-results/**', '**/server/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5000,
    host: '0.0.0.0',
  },
})
