import type { ExpoConfig } from 'expo/config';

// Google OAuth on native uses the *application id* as the redirect scheme.
// expo-auth-session's Google provider builds
// `me.ethanasm.vpt:/oauthredirect` from Application.applicationId. iOS appends
// the bundle id to CFBundleURLSchemes automatically; Android does NOT, so the
// package name must be listed in `scheme` explicitly or Chrome drops the
// callback. (See the showbook app.config.ts header for the full rationale.)
const ANDROID_PACKAGE = 'me.ethanasm.vpt';

const config: ExpoConfig = {
  name: 'Price Tracker',
  slug: 'vpt',
  owner: 'ethanasm',
  // runtimeVersion below derives the expo-updates runtime from this string.
  // P4 owns version bumps; foundation ships 0.1.0.
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: ['vpt', ANDROID_PACKAGE],
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'me.ethanasm.vpt',
    supportsTablet: true,
    // ios.config must be a defined object — Expo's withUsesNonExemptEncryption
    // plugin does `'usesNonExemptEncryption' in config.ios.config`.
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
      ITSAppUsesNonExemptEncryption: false,
      // The iOS simulator hits the FastAPI dev server on localhost over the
      // dev cert; scope the insecure exception to localhost so prod policy
      // stays strict.
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: {
          localhost: {
            NSIncludesSubdomains: true,
            NSExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      },
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#7C3AED',
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    'expo-notifications',
    [
      'expo-splash-screen',
      {
        // image MUST stay set or the release Android build fails at
        // processReleaseResources ("drawable/splashscreen_logo not found").
        image: './assets/splash.png',
        imageWidth: 200,
        backgroundColor: '#FAF8FF',
        resizeMode: 'contain',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  // `updates.url` and `extra.eas.projectId` are intentionally absent — P4
  // adds them when it provisions the EAS project (mobile-cicd plan).
};

export default config;
