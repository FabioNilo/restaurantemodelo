type MarmitasRuntimeConfig = Partial<Record<string, string>>;

const BUILD_CONFIG: MarmitasRuntimeConfig = {
  VITE_CHIPTRACK_WEBHOOK_BASE_URL: import.meta.env.VITE_CHIPTRACK_WEBHOOK_BASE_URL,
  CHIPTRACK_WEBHOOK_BASE_URL: import.meta.env.CHIPTRACK_WEBHOOK_BASE_URL,
  VITE_N8N_BASE_URL: import.meta.env.VITE_N8N_BASE_URL,
  VITE_CHIPTRACK_WEBHOOK_KEY: import.meta.env.VITE_CHIPTRACK_WEBHOOK_KEY,
  CHIPTRACK_WEBHOOK_KEY: import.meta.env.CHIPTRACK_WEBHOOK_KEY,
  VITE_N8N_WEBHOOK_KEY: import.meta.env.VITE_N8N_WEBHOOK_KEY,
  VITE_MARMITAS_PUBLIC_API: import.meta.env.VITE_MARMITAS_PUBLIC_API,
  VITE_MARMITAS_AUTH_API: import.meta.env.VITE_MARMITAS_AUTH_API,
  VITE_MARMITAS_ADMIN_API: import.meta.env.VITE_MARMITAS_ADMIN_API,
};

declare global {
  interface Window {
    __MARMITAS_CONFIG__?: MarmitasRuntimeConfig;
  }
}

export function getRuntimeConfigValue(key: string) {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const value = window.__MARMITAS_CONFIG__?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getConfigValue(...keys: string[]) {
  for (const key of keys) {
    const runtimeValue = getRuntimeConfigValue(key);
    if (runtimeValue) {
      return runtimeValue;
    }

    const buildValue = BUILD_CONFIG[key];
    if (typeof buildValue === 'string' && buildValue.trim()) {
      return buildValue.trim();
    }
  }

  return undefined;
}
