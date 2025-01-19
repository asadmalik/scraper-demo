import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        contentScript: path.resolve(__dirname, 'src/content/contentScript.ts'),
        background: path.resolve(__dirname, 'src/background/background.ts'),
      },
      output: {
        entryFileNames: '[name].js'
      }
    }
  }
})
