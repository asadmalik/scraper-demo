// vite.config.js
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    // We don't minify heavily, so it's easier to debug for extension dev
    minify: false,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        // We'll create a dummy HTML or skip HTML for these:
        contentScript: path.resolve(__dirname, 'src/content/contentScript.ts'),
        background: path.resolve(__dirname, 'src/background/background.ts'),
      },
      output: {
        entryFileNames: '[name].js'
      }
    }
  }
})
