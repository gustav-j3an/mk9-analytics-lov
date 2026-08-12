import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCurrentPromoter } from "@/lib/mk9-auth/promoter-resolver.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateVisitLocation } from "./location";

export const uploadVisitEvidence = createServerFn({ method: "POST" })
  .inputValidator((data) => 
    z.object({
      plannedRouteId: z.string().uuid(),
      photoPath: z.string(),
      capturedAt: z.string().datetime().optional(),
      mimeType: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      accuracy: z.number().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const promoter = await getCurrentPromoter();
    if (!promoter) {
      throw new Error("PROMOTER_NOT_FOUND");
    }

    // Validação de MIME Type no servidor
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (data.mimeType && !allowedMimeTypes.includes(data.mimeType)) {
      // Se subir algo inválido, tentamos limpar imediatamente
      await supabaseAdmin.storage.from("visit-evidence").remove([data.photoPath]);
      throw new Error("INVALID_FILE_TYPE");
    }

    // 1. Validar que a planned_route pertence ao promotor e obter IDs relacionados
    const { data: route, error: routeError } = await supabaseAdmin
      .from("mk9_planned_routes")
      .select(`
        id, 
        promoter_id, 
        store_id, 
        industry_id,
        store:mk9_stores(latitude, longitude)
      `)
      .eq("id", data.plannedRouteId)
      .eq("promoter_id", promoter.id)
      .single();

    if (routeError || !route) {
      // Se a rota for inválida ou acesso negado, limpar upload órfão
      await supabaseAdmin.storage.from("visit-evidence").remove([data.photoPath]);
      throw new Error("INVALID_ROUTE_OR_ACCESS_DENIED");
    }

    // 2. Validar Localização
    let locationData = {
      distance: null as number | null,
      status: 'UNAVAILABLE' as any,
    };

    if (data.latitude !== undefined && data.longitude !== undefined && data.accuracy !== undefined) {
      const storeCoords = (route.store as any);
      const validation = validateVisitLocation(
        data.latitude,
        data.longitude,
        data.accuracy,
        storeCoords?.latitude ?? null,
        storeCoords?.longitude ?? null
      );
      locationData = {
        distance: validation.distance,
        status: validation.status
      };
    }

    // 3. Verificar se já existe evidência para esta visita
    const { data: existingEvidence, error: fetchError } = await supabaseAdmin
      .from("mk9_visit_evidence")
      .select("id, photo_path, status")
      .eq("planned_route_id", route.id)
      .maybeSingle();

    if (fetchError) {
      await supabaseAdmin.storage.from("visit-evidence").remove([data.photoPath]);
      throw fetchError;
    }

    // Regra: APPROVED ou REJECTED (bloqueado por enquanto) não podem ser substituídas
    if (existingEvidence && existingEvidence.status !== "PENDING") {
      await supabaseAdmin.storage.from("visit-evidence").remove([data.photoPath]);
      throw new Error("EVIDENCE_ALREADY_PROCESSED");
    }

    if (existingEvidence) {
      // 3. Atualizar evidência existente (Substituição Segura)
      const oldPhotoPath = existingEvidence.photo_path;
      
      const { error: updateError } = await supabaseAdmin
        .from("mk9_visit_evidence")
        .update({
          photo_path: data.photoPath,
          captured_at: data.capturedAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", existingEvidence.id);

      if (updateError) {
        // Se falhar o banco, removemos a foto nova pra não ficar órfã
        await supabaseAdmin.storage.from("visit-evidence").remove([data.photoPath]);
        throw updateError;
      }

      // 4. Tentar remover arquivo antigo (Cleanup)
      // Se falhar aqui, não revertemos o banco (B é válida), mas emitimos log
      if (oldPhotoPath !== data.photoPath) {
        try {
          await supabaseAdmin.storage.from("visit-evidence").remove([oldPhotoPath]);
        } catch (cleanupErr) {
          console.error("[EVIDENCE] Falha ao remover foto antiga órfã:", oldPhotoPath, cleanupErr);
        }
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

    if (insertError) {
      // Se falhar a criação no banco, limpar o upload do storage
      await supabaseAdmin.storage.from("visit-evidence").remove([data.photoPath]);
      throw insertError;
    }

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
