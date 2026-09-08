import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.badmintonboys.app',
  appName: 'Badminton Boys',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: {
    backgroundColor: '#000000',
    // Keeps the app usable on a bench-side phone that gets rotated a lot.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
