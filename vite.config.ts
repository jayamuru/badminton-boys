/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so the same build works at a domain root, in a
  // GitHub Pages subfolder, and inside the Capacitor Android web view.
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    css: false,
    // The suite exercises the local/demo path, and it must do so whether or not
    // the machine running it happens to have a .env.local with real Supabase
    // credentials — otherwise `npm test` passes on CI and fails on the laptop
    // that just finished setting up the backend.
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
})
