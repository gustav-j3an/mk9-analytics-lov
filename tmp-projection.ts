// Fase 1B.4 — verificação do bloqueio de escrita direta na projeção.
import { supabaseAdmin as sb } from "@/integrations/supabase/client.server";

const out: any = {};
const { data: row } = await sb
  .from("mk9_industry_store_frequency")
  .select("industry_id, store_id, weekly_frequency, monthly_frequency")
  .limit(1)
  .single();
out.alvo = { weekly: row!.weekly_frequency, monthly: row!.monthly_frequency };

const upd = await sb
  .from("mk9_industry_store_frequency")
  .update({ weekly_frequency: 99 })
  .eq("industry_id", row!.industry_id)
  .eq("store_id", row!.store_id)
  .select("industry_id");
out.updateBloqueado = { code: upd.error?.code ?? null, msg: upd.error?.message?.slice(0, 100) ?? null, linhas: upd.data?.length ?? 0 };

const del = await sb
  .from("mk9_industry_store_frequency")
  .delete()
  .eq("industry_id", row!.industry_id)
  .eq("store_id", row!.store_id)
  .select("industry_id");
out.deleteBloqueado = { code: del.error?.code ?? null, msg: del.error?.message?.slice(0, 100) ?? null, linhas: del.data?.length ?? 0 };

const ins = await sb
  .from("mk9_industry_store_frequency")
  .insert({ industry_id: row!.industry_id, store_id: row!.store_id, weekly_frequency: 5 })
  .select("industry_id");
out.insertBloqueado = { code: ins.error?.code ?? null, msg: ins.error?.message?.slice(0, 100) ?? null };

const { data: after } = await sb
  .from("mk9_industry_store_frequency")
  .select("weekly_frequency, monthly_frequency")
  .eq("industry_id", row!.industry_id)
  .eq("store_id", row!.store_id)
  .maybeSingle();
out.depois = after;
console.log(JSON.stringify(out, null, 2));
