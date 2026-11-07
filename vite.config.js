import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  server: {
    headers: {
      // Firebase's signInWithPopup closes its own popup once Google hands the
      // credential back. Under the default Cross-Origin-Opener-Policy the
      // opener and the popup sit in different browsing-context groups, so that
      // window.close() is blocked and the popup hangs on an apparently
      // successful sign-in. allow-popups keeps the isolation for everything
      // else while letting the auth popup finish.
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
