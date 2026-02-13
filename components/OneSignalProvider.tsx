'use client';

import { useEffect } from 'react';

const ONESIGNAL_SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

type OneSignalDeferredCallback = (OneSignal: unknown) => void | Promise<void>;
declare global {
  interface Window {
    OneSignalDeferred?: OneSignalDeferredCallback[];
  }
}

/**
 * Initializes OneSignal Web SDK so that push subscription and player ID
 * are available (e.g. on the register page when user enables push).
 * Only runs when NEXT_PUBLIC_ONESIGNAL_APP_ID is set.
 */
export function OneSignalProvider() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId || typeof window === 'undefined') return;

    if (!window.OneSignalDeferred) window.OneSignalDeferred = [];

    window.OneSignalDeferred.push(
      async (OneSignal: unknown) => {
        const os = OneSignal as { init: (opts: { appId: string; allowLocalhostAsSecureOrigin?: boolean }) => Promise<void> };
        if (os?.init) {
          await os.init({
            appId,
            allowLocalhostAsSecureOrigin: typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'),
          });
        }
      }
    );

    const script = document.createElement('script');
    script.src = ONESIGNAL_SDK_URL;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  return null;
}
