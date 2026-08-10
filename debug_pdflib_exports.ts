import * as pdflib from 'pdf-lib';
console.log('--- PDF-LIB DEBUG ---');
console.log('Keys:', Object.keys(pdflib));
console.log('Default type:', typeof (pdflib as any).default);
if ((pdflib as any).default) {
  console.log('Default keys:', Object.keys((pdflib as any).default));
}
console.log('PDFDocument type:', typeof pdflib.PDFDocument);
console.log('--- END ---');
