import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfLib from "pdf-lib";

async function test() {
  console.log("TEST_START");
  try {
    console.log("Checking PDFDocument type:", typeof PDFDocument);
    console.log("Checking pdfLib.PDFDocument type:", typeof pdfLib.PDFDocument);
    
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([200, 200]);
    page.drawText("MK9 TEST", { x: 50, y: 100, size: 20 });
    const bytes = await pdf.save();
    console.log("PDF generated, length:", bytes.length);
    console.log("TEST_SUCCESS");
  } catch (e: any) {
    console.log("TEST_ERROR:", e.name, e.message);
    console.log("STACK:", e.stack);
  }
  console.log("TEST_END");
}

test();
