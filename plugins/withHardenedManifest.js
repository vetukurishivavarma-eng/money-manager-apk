/**
 * Security hardening for the generated AndroidManifest:
 *  - android:allowBackup="false"  -> the SQLite DB can't be pulled via `adb backup`
 *  - drop SYSTEM_ALERT_WINDOW     -> no "draw over other apps" (tapjacking surface),
 *                                    pulled in transitively by react-native-android-widget
 *  - drop RECEIVE_SMS             -> the app only *reads* the inbox on a schedule,
 *                                    it has no broadcast receiver for incoming SMS
 */
const { withAndroidManifest } = require('expo/config-plugins');

const STRIP = new Set([
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.RECEIVE_SMS',
]);

module.exports = function withHardenedManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest['uses-permission'] = (manifest['uses-permission'] || []).filter(
      (p) => !STRIP.has(p.$?.['android:name']),
    );
    manifest['uses-permission-sdk-23'] = (manifest['uses-permission-sdk-23'] || []).filter(
      (p) => !STRIP.has(p.$?.['android:name']),
    );

    const app = manifest.application?.[0];
    if (app) {
      app.$['android:allowBackup'] = 'false';
      app.$['android:fullBackupContent'] = 'false';
    }
    return cfg;
  });
};
