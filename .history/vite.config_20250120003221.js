import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        // For the popup: we'll generate an HTML that loads our main popup code.
        popup: 'popup.html', 
      },
      output: {
        entryFileNames: (chunk) => {
          // Example: keep .js in root for extension
          return `[name].js`
        },
      }
    },
    // We want to avoid code-splitting so everything is in single files
    // that the extension can easily reference
    // (Though code-splitting can still work if carefully managed)
    // e.g.:
    // sourcemap: true,
    // emptyOutDir: false
  }
})
