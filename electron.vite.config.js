import { resolve } from 'path'
import pkg from './package.json'
import { defineConfig, loadEnv } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    main: {
      define: {
        'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID || ''),
        'process.env.GOOGLE_CLIENT_SECRET': JSON.stringify(env.GOOGLE_CLIENT_SECRET || ''),
        'process.env.BACKUP_RECOVERY_PASSWORD': JSON.stringify(env.BACKUP_RECOVERY_PASSWORD || ''),
        'process.env.WAVY_LICENSE_SECRET': JSON.stringify(env.WAVY_LICENSE_SECRET || '')
      },
      build: {
        rollupOptions: {
          external: ['sql.js', 'bcryptjs', 'googleapis', 'http', 'stream', 'crypto', 'fs', 'path', 'exceljs']
        }
      }
    },
    preload: {
      build: {
        rollupOptions: {
          input: resolve('src/preload/index.js')
        }
      }
    },
    renderer: {
      define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)
      },
      resolve: {
        alias: {
          '@': resolve('src/renderer/src'),
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [vue()],
      server: {
        headers: {
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; worker-src 'self' blob:"
        }
      }
    }
  }
})
