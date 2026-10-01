import type { CapacitorConfig } from '@capacitor/cli';

/** Native shells (Android / iOS) around the Angular app. The web build must exist first: `npm run build:mobile`. */
const config: CapacitorConfig = {
  appId: 'net.flowly.app',
  appName: 'Flowly',
  webDir: 'dist/flowly-frontend/browser',
  android: { allowMixedContent: false },
  ios: { contentInset: 'automatic' },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#4f46e5', showSpinner: false },
  },
};

export default config;
