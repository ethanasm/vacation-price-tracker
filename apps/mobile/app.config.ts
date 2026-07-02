import type { ExpoConfig } from "expo/config";
import {
	AndroidConfig,
	type ConfigPlugin,
	withAndroidManifest,
} from "expo/config-plugins";

// Google OAuth on native uses the *application id* as the redirect scheme.
// expo-auth-session's Google provider builds
// `me.ethanasm.vacation_price_tracker:/oauthredirect` from
// Application.applicationId (the Android package) at runtime — the Expo config
// `scheme` never changes the redirect URI, it only registers which schemes the
// app catches. iOS appends its bundle id to CFBundleURLSchemes automatically;
// Android does NOT, so the package name must be registered in the Android
// manifest or Chrome drops the callback. It cannot live in `scheme`: underscores
// are invalid there (`^[a-z][a-z0-9+.-]*$`) and EAS Update rejects the whole
// manifest on publish. withAndroidOAuthRedirectScheme below registers it at
// prebuild instead, which never passes through that validation.
//
// The iOS bundle id uses HYPHENS (me.ethanasm.vacation-price-tracker) because
// Apple disallows underscores in CFBundleIdentifier; Android keeps underscores
// (valid there). The two ids therefore differ by design — make sure the iOS
// vs Android Google OAuth clients are each registered with the matching id.
const ANDROID_PACKAGE = "me.ethanasm.vacation_price_tracker";
const IOS_BUNDLE_ID = "me.ethanasm.vacation-price-tracker";

const withAndroidOAuthRedirectScheme: ConfigPlugin = (cfg) =>
	withAndroidManifest(cfg, (manifestCfg) => {
		manifestCfg.modResults = AndroidConfig.Scheme.appendScheme(
			ANDROID_PACKAGE,
			manifestCfg.modResults,
		);
		return manifestCfg;
	});

// The e2e APK reaches the loopback VPT e2e backend over cleartext
// http://10.0.2.2:8010 (see infra/docker-compose.e2e.yml). Android API 28+
// release builds block cleartext by default, so the e2e build needs
// android:usesCleartextTraffic="true" in its manifest. Gated on
// EXPO_PUBLIC_E2E_MODE (set only by the e2e build profile / mobile.yml),
// so prod/preview builds keep the strict HTTPS-only policy.
const IS_E2E_BUILD = process.env.EXPO_PUBLIC_E2E_MODE === "1";

const withE2EAndroidCleartext: ConfigPlugin = (cfg) =>
	withAndroidManifest(cfg, (manifestCfg) => {
		const application = manifestCfg.modResults.manifest.application?.[0];
		if (application) {
			application.$["android:usesCleartextTraffic"] = "true";
		}
		return manifestCfg;
	});

const config: ExpoConfig = {
	name: "Price Tracker",
	slug: "vacation-price-tracker",
	owner: "ethanasm",
	// runtimeVersion below derives the expo-updates runtime from this string.
	// P4 owns version bumps; foundation ships 0.1.0.
	version: "0.1.0",
	orientation: "portrait",
	icon: "./assets/icon.png",
	scheme: "vpt",
	userInterfaceStyle: "light",
	ios: {
		bundleIdentifier: IOS_BUNDLE_ID,
		supportsTablet: true,
		// ios.config must be a defined object — Expo's withUsesNonExemptEncryption
		// plugin does `'usesNonExemptEncryption' in config.ios.config`.
		config: {
			usesNonExemptEncryption: false,
		},
		infoPlist: {
			UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],
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
			foregroundImage: "./assets/adaptive-icon.png",
			backgroundColor: "#7C3AED",
		},
	},
	plugins: [
		"expo-router",
		"expo-font",
		"expo-secure-store",
		"expo-notifications",
		[
			"expo-splash-screen",
			{
				// image MUST stay set or the release Android build fails at
				// processReleaseResources ("drawable/splashscreen_logo not found").
				image: "./assets/splash.png",
				imageWidth: 200,
				backgroundColor: "#FAF8FF",
				resizeMode: "contain",
			},
		],
	],
	experiments: {
		typedRoutes: true,
	},
	runtimeVersion: {
		policy: "appVersion",
	},
	// P4 (mobile-cicd): EAS Update wiring. expo-updates resolves OTA bundles from
	// this URL; the runtime version is derived from `version` above via the
	// runtimeVersion.policy='appVersion' setting.
	updates: {
		url: "https://u.expo.dev/6ab19d8f-51fd-4bce-b47f-4b2828209c04",
	},
	extra: {
		// Links this app to the EAS project (created via `eas init`). Required for
		// `eas build`/`eas update` and Expo push tokens.
		eas: {
			projectId: "6ab19d8f-51fd-4bce-b47f-4b2828209c04",
		},
	},
};

export default withAndroidOAuthRedirectScheme(
	IS_E2E_BUILD ? withE2EAndroidCleartext(config) : config,
);
