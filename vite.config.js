import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix = load everything including non-VITE_ vars)
  const env = loadEnv(mode, process.cwd(), '')

  // The Anthropic key — check both VITE_ANTHROPIC_KEY and ANTHROPIC_KEY
  const ANTHROPIC_KEY = env.VITE_ANTHROPIC_KEY || env.ANTHROPIC_KEY || ''

  if (!ANTHROPIC_KEY) {
    console.warn('\n⚠️  ANTHROPIC_KEY not found in .env — OCR will fail with 401\n  Add: VITE_ANTHROPIC_KEY=sk-ant-... to your .env file\n')
  } else {
    console.log('\n✅ Anthropic API key loaded — OCR proxy ready\n')
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-api-key', ANTHROPIC_KEY)
              proxyReq.setHeader('anthropic-version', '2023-06-01')
              proxyReq.removeHeader('origin')
            })
            proxy.on('error', (err) => {
              console.error('OCR proxy error:', err.message)
            })
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
