import { renderPromoterRoutePdf } from "./src/lib/reports/promoter-pdf.server";

async function run() {
  console.log("TEST_ISOLATION_START");
  try {
    const bytes = await renderPromoterRoutePdf({
      routes: [{
        id: "1",
        weekday: 1,
        storeId: "s1",
        storeName: "Loja Teste",
        storeChain: "Rede",
        storeUf: "DF",
        industryName: "Ind 1"
      }],
      promoterName: "Teste",
      referenceDate: "2026-08-10"
    });
    console.log("Bytes generated:", bytes.length);
    console.log("TEST_ISOLATION_SUCCESS");
  } catch (e: any) {
    console.log("TEST_ISOLATION_ERROR:", e.name, e.message);
    console.log("STACK:", e.stack);
  }
}
run();
