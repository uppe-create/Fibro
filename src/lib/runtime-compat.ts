export type RuntimeCompat = {
  isBrowser: boolean;
  isFirefox: boolean;
  deviceMemoryGb: number | null;
  prefersReducedMotion: boolean;
  preferReducedEffects: boolean;
  preferSafeCanvas: boolean;
};

export type RuntimeDiagnostic = {
  kind: string;
  message: string;
  timestamp: string;
  userAgent?: string;
  activeTab?: string;
  role?: string;
  details?: Record<string, unknown> | null;
};

const CLIENT_DIAGNOSTIC_KEY = 'cipf_client_last_error';

export function detectBrowser(userAgent = '') {
  const normalized = String(userAgent || '').toLowerCase();
  return {
    isFirefox: normalized.includes('firefox') && !normalized.includes('seamonkey')
  };
}

export function shouldPreferReducedEffects(input: {
  isFirefox?: boolean;
  deviceMemoryGb?: number | null;
  prefersReducedMotion?: boolean;
}) {
  return Boolean(
    input.prefersReducedMotion ||
    input.isFirefox ||
    (typeof input.deviceMemoryGb === 'number' && input.deviceMemoryGb > 0 && input.deviceMemoryGb <= 4)
  );
}

export function getRuntimeCompat(): RuntimeCompat {
  const isBrowser = typeof window !== 'undefined';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const { isFirefox } = detectBrowser(userAgent);
  const deviceMemoryGb =
    typeof navigator !== 'undefined' && typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === 'number'
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory || null
      : null;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const preferReducedEffects = shouldPreferReducedEffects({ isFirefox, deviceMemoryGb, prefersReducedMotion });

  return {
    isBrowser,
    isFirefox,
    deviceMemoryGb,
    prefersReducedMotion,
    preferReducedEffects,
    preferSafeCanvas: isFirefox
  };
}

function persistClientDiagnostic(entry: RuntimeDiagnostic) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CLIENT_DIAGNOSTIC_KEY, JSON.stringify(entry));
  } catch {
    // localStorage can fail in hardened/private contexts.
  }
}

export function logClientDiagnostic(
  kind: string,
  message: string,
  details?: Record<string, unknown> | null,
  context?: { activeTab?: string; role?: string }
) {
  const entry: RuntimeDiagnostic = {
    kind,
    message,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    activeTab: context?.activeTab,
    role: context?.role,
    details: details || null
  };

  if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
    console.info('[cipf-runtime]', entry);
  } else {
    persistClientDiagnostic(entry);
  }
}

export function installGlobalClientDiagnostics(getContext: () => { activeTab?: string; role?: string }) {
  if (typeof window === 'undefined') return () => {};

  const onError = (event: ErrorEvent) => {
    logClientDiagnostic(
      'window.onerror',
      event.message || 'Unhandled runtime error',
      {
        source: event.filename || '',
        line: event.lineno || 0,
        column: event.colno || 0
      },
      getContext()
    );
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    logClientDiagnostic(
      'unhandledrejection',
      String(reason?.message || reason || 'Unhandled promise rejection'),
      null,
      getContext()
    );
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
