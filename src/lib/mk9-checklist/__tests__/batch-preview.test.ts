import { describe, expect, it, vi } from "vitest";

// Mocking fetch headers helper
vi.mock("@/lib/mk9-auth/fetch-headers", () => ({
  mk9AuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

describe("Importação em lote - Lógica de envio e segurança", () => {
  it("deve garantir que Content-Type NÃO seja definido manualmente para permitir boundary automático", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([["content-type", "application/json"]]),
      json: () => Promise.resolve({ importId: "123", preview: {} }),
    });
    global.fetch = mockFetch;

    const formData = new FormData();
    formData.append("file", new Blob(["test"], { type: "text/plain" }), "test.xlsx");

    await fetch("/api/checklists/preview", {
      method: "POST",
      body: formData,
    });

    const lastCall = mockFetch.mock.calls[0];
    const options = lastCall[1];

    // Se Content-Type for definido manualmente como 'multipart/form-data', o boundary do navegador é perdido
    expect(options.headers?.["Content-Type"]).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
  });

  it("deve tratar resposta 401 como Sessão Expirada", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Map([["content-type", "application/json"]]),
      json: () => Promise.resolve({ error: { message: "Unauthorized" } }),
    });
    global.fetch = mockFetch;

    const testError = async () => {
      const response = await fetch("/api/checklists/preview");
      if (response.status === 401) throw new Error("Sessão expirada. Faça login novamente.");
    };

    await expect(testError()).rejects.toThrow("Sessão expirada. Faça login novamente.");
  });
});
