import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCurrentPromoter } from "@/lib/mk9-auth/promoter-resolver.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const uploadVisitEvidence = createServerFn({ method: "POST" })
  .inputValidator((data) => 
    z.object({
      plannedRouteId: z.string().uuid(),
      photoPath: z.string(),
      capturedAt: z.string().datetime().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const promoter = await getCurrentPromoter();
    if (!promoter) {
      throw new Error("PROMOTER_NOT_FOUND");
    }

    // 1. Validar que a planned_route pertence ao promotor e obter IDs relacionados
    const { data: route, error: routeError } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select("id, promoter_id, store_id, industry_id")
      .eq("id", data.plannedRouteId)
      .eq("promoter_id", promoter.id)
      .single();

    if (routeError || !route) {
      throw new Error("INVALID_ROUTE_OR_ACCESS_DENIED");
    }

    // 2. Verificar se já existe evidência PENDING para esta visita
    const { data: existingEvidence } = await supabaseAdmin
      .from("mk9_visit_evidence")
      .select("id, photo_path")
      .eq("planned_route_id", route.id)
      .eq("status", "PENDING")
      .maybeSingle();

    if (existingEvidence) {
      // 3. Atualizar evidência existente (Substituição)
      const oldPhotoPath = existingEvidence.photo_path;
      
      const { error: updateError } = await supabaseAdmin
        .from("mk9_visit_evidence")
        .update({
          photo_path: data.photoPath,
          captured_at: data.capturedAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", existingEvidence.id);

      if (updateError) throw updateError;

      // 4. Tentar remover arquivo antigo (Cleanup)
      if (oldPhotoPath !== data.photoPath) {
        await supabaseAdmin.storage.from("visit-evidence").remove([oldPhotoPath]);
      }

      return { success: true, id: existingEvidence.id, updated: true };
    }

    // 5. Criar nova evidência
    const { data: newEvidence, error: insertError } = await supabaseAdmin
      .from("mk9_visit_evidence")
      .insert({
        promoter_id: promoter.id,
        planned_route_id: route.id,
        store_id: route.store_id,
        industry_id: route.industry_id,
        photo_path: data.photoPath,
        status: "PENDING",
        captured_at: data.capturedAt || new Date().toISOString()
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return { success: true, id: newEvidence.id, updated: false };
  });

export const getEvidenceSignedUrl = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ photoPath: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const promoter = await getCurrentPromoter();
    if (!promoter) throw new Error("Unauthorized");

    const { data: signedData, error } = await supabaseAdmin.storage
      .from("visit-evidence")
      .createSignedUrl(data.photoPath, 3600);

    if (error) throw error;
    return { signedUrl: signedData.signedUrl };
  });

export const getMyVisitEvidence = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ plannedRouteId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const promoter = await getCurrentPromoter();
    if (!promoter) throw new Error("Unauthorized");

    const { data: evidence, error } = await supabaseAdmin
      .from("mk9_visit_evidence")
      .select("*")
      .eq("planned_route_id", data.plannedRouteId)
      .eq("promoter_id", promoter.id)
      .maybeSingle();

    if (error) throw error;
    if (!evidence) return null;

    const { data: signedData } = await supabaseAdmin.storage
      .from("visit-evidence")
      .createSignedUrl(evidence.photo_path, 3600);

    return {
      ...evidence,
      signedUrl: signedData?.signedUrl
    };
  });
