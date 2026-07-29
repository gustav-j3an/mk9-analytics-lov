/**
 * MK9 — Cabeçalho de autorização para chamadas fetch às rotas HTTP internas
 * (/api/reports/industry-pdf e /api/checklists/preview).
 *
 * As server functions recebem o bearer automaticamente pelo middleware do
 * TanStack Start; chamadas fetch manuais precisam anexar o token explicitamente.
 */
import { supabase } from "@/integrations/supabase/client";

export async function mk9AuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
