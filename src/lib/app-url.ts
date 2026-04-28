export function getAppBaseUrl(): string {
  const configuredUrl = (import.meta as any)?.env?.VITE_APP_URL as string | undefined;
  if (configuredUrl && configuredUrl.trim()) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }

  return 'http://localhost:5173';
}

