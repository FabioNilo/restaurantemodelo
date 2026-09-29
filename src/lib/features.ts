import { hasN8NBaseUrl } from '@/lib/api';
import { getConfigValue } from '@/lib/runtime-config';

// Módulos que dependem de backend além do cardápio. Na API própria desta
// versão (server/) só Cardápio, Configurações e Login existem; os demais ficam
// escondidos até serem habilitados com VITE_FEATURE_<MODULO>=true.
// No modo demo (sem API) continuam visíveis, como antes.
export type FeatureName = 'pedidos' | 'caixa' | 'entregas' | 'gestores';

export function isFeatureEnabled(feature: FeatureName) {
  const flag = getConfigValue(`VITE_FEATURE_${feature.toUpperCase()}`);

  if (flag !== undefined) {
    return flag === 'true';
  }

  return !hasN8NBaseUrl();
}
