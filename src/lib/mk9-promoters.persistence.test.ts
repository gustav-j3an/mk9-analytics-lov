import { describe, it, expect } from "vitest";
import { mk9CreatePromoter, mk9UpdatePromoter, mk9ArchivePromoter, mk9ReactivatePromoter } from "./mk9-promoters.functions";
import { mk9ListPromoters } from "./mk9-data.functions";

describe("Persistência do Módulo de Promotores", () => {
  let testPromoterId: string;

  it("deve criar um promotor com UF e persistir no banco", async () => {
    const result = await mk9CreatePromoter({
      data: {
        name: "Promotor Teste Persistência",
        city: "Brasília",
        uf: "DF",
        contact: "6199999999",
        notes: "Teste de persistência real"
      }
    });
    
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect((result as any).uf).toBe("DF");
    testPromoterId = result.id;

    // Valida via listagem
    const list = await mk9ListPromoters();
    const found = list.find((p: any) => p.id === testPromoterId);
    expect(found).toBeDefined();
    expect(found!.uf).toBe("DF");
  });

  it("deve editar a UF e outros campos e manter após 'refresh' (nova listagem)", async () => {
    const listBefore = await mk9ListPromoters();
    const promoter = listBefore.find((p: any) => p.id === testPromoterId);
    expect(promoter).toBeDefined();
    
    await mk9UpdatePromoter({
      data: {
        id: testPromoterId,
        data: {
          name: "Promotor Teste Editado",
          city: "Goiânia",
          uf: "GO",
          contact: "6288888888",
          notes: "Editado com sucesso"
        },
        expectedUpdatedAt: promoter!.updatedAt
      }
    });

    const listAfter = await mk9ListPromoters();
    const found = listAfter.find((p: any) => p.id === testPromoterId);
    expect(found).toBeDefined();
    expect(found!.uf).toBe("GO");
    expect(found!.city).toBe("Goiânia");
    expect(found!.name).toBe("Promotor Teste Editado");
  });

  it("deve arquivar o promotor e ele deve aparecer como inativo", async () => {
    await mk9ArchivePromoter({
      data: {
        id: testPromoterId,
        reason: "Teste de arquivamento"
      }
    });

    const list = await mk9ListPromoters();
    const found = list.find((p: any) => p.id === testPromoterId);
    expect(found).toBeDefined();
    expect(found!.isActive).toBe(false);
    expect(found!.archivedAt).not.toBeNull();
  });

  it("deve reativar o promotor e ele deve voltar a ser ativo", async () => {
    await mk9ReactivatePromoter({
      data: {
        id: testPromoterId
      }
    });

    const list = await mk9ListPromoters();
    const found = list.find((p: any) => p.id === testPromoterId);
    expect(found).toBeDefined();
    expect(found!.isActive).toBe(true);
    expect(found!.archivedAt).toBeNull();
  });
});
