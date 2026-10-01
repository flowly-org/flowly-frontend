import { Capacitor } from '@capacitor/core';

/** True inside the Android/iOS app (Capacitor), false on the web. */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Native integrations: status bar colours, Android back button. No-ops on the web. */
export async function setupNative(onBack: () => boolean): Promise<void> {
  if (!isNative()) return;
  const [{ App }, { StatusBar, Style }] = await Promise.all([import('@capacitor/app'), import('@capacitor/status-bar')]);
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  App.addListener('backButton', () => {
    // Let the page close an open dialog first; otherwise go back, or leave the app from the root.
    if (onBack()) return;
    if (window.history.length > 1) window.history.back();
    else App.exitApp();
  });
}
