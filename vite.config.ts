import { defineConfig, loadEnv } from 'vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      TanStackRouterVite(),
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      viteReact(),
    ],
    base: env.VITE_BASE_PATH || '/',
    build: {
      outDir: 'dist',
    },
    server: {
      port: 5173,
    },
  }
})
