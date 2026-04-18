import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // 將 React 核心拆出，使其得以獨立快取（更新頻率低）
          'react-vendor': ['react', 'react-dom', 'react-dom/client'],
          // Socket.IO 也獨立一個 chunk
          'socket-vendor': ['socket.io-client'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
      '/terminal-ws': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
})
