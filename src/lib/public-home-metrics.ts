import { assertSupabaseConfigured, isSupabaseConfigured, supabase } from '@/lib/supabase';

export type HomeMetrics = {
  registrationsTotal: number;
  issuedTotal: number;
};

export const HOME_METRICS_FALLBACK: HomeMetrics = {
  registrationsTotal: 1284,
  issuedTotal: 1107
};

export function formatMetricValue(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export async function fetchHomeMetrics(): Promise<HomeMetrics> {
  if (!isSupabaseConfigured) return HOME_METRICS_FALLBACK;
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_home_metrics');
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    registrationsTotal: Number(row?.registrations_total || 0),
    issuedTotal: Number(row?.issued_total || 0)
  };
}
