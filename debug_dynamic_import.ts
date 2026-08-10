async function run() {
  console.log('--- DYNAMIC IMPORT DEBUG ---');
  try {
    const mod = await import('./src/lib/reports/promoter-pdf.server');
    console.log('Module keys:', Object.keys(mod));
    console.log('renderPromoterRoutePdf type:', typeof mod.renderPromoterRoutePdf);
  } catch (e: any) {
    console.log('Error:', e.message);
    console.log('Stack:', e.stack);
  }
}
run();
