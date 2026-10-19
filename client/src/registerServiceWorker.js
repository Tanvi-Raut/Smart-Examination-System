/**
 * Smart Examination Management System
 * PWA Service Worker Registration & Installation Manager
 */

let deferredInstallPrompt = null;
let swRegistration = null;

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[PWA] Service Workers are not supported in this browser.');
    return;
  }

  // Capture PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-can-install', { detail: true }));
    console.log('[PWA] beforeinstallprompt event captured. App can be installed.');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed', { detail: true }));
    console.log('[PWA] Smart Examination PWA successfully installed on device.');
  });

  // Register service worker after window loads
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      swRegistration = reg;
      console.log('[PWA] Service Worker registered with scope:', reg.scope);

      // Check if updating
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available. Refresh to activate.');
              window.dispatchEvent(new CustomEvent('pwa-update-available'));
            }
          });
        }
      });
    } catch (err) {
      console.error('[PWA] Service Worker registration failed:', err);
    }
  });
}

/**
 * Trigger browser native PWA installation dialog
 */
export async function promptPwaInstall() {
  if (!deferredInstallPrompt) {
    return { success: false, reason: 'Install prompt not available or app already installed' };
  }
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return { success: choice.outcome === 'accepted', outcome: choice.outcome };
}

/**
 * Check whether PWA is currently running in standalone / installed mode
 */
export function isPwaRunningStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Inspect PWA & App Shell cache storage
 */
export async function getPwaCacheStats() {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { isSupported: false, cacheSize: 0, entriesCount: 0 };
  }

  try {
    const cacheNames = await caches.keys();
    let totalEntries = 0;

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      totalEntries += keys.length;
    }

    let quotaStats = null;
    if (navigator.storage && navigator.storage.estimate) {
      quotaStats = await navigator.storage.estimate();
    }

    return {
      isSupported: true,
      cacheNames,
      entriesCount: totalEntries,
      hasCachedAppShell: totalEntries > 0,
      quota: quotaStats
    };
  } catch (err) {
    console.error('Error fetching cache stats:', err);
    return { isSupported: true, error: err.message, entriesCount: 0 };
  }
}
