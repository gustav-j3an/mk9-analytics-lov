import { parseChecklistWorkbook } from '../src/lib/mk9-checklist/parser.ts';
import fs from 'fs';
const buf = fs.readFileSync('/tmp/king.xlsx');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength);
const r = parseChecklistWorkbook(ab,'king.xlsx',{});
console.log({stores:r.stores.length,marks:r.marks.length,first:r.firstDate,last:r.lastDate,cols:r.dateColumnCount,realizado:r.realizadoSum,warnings:r.warnings});
console.log('sample:', r.marks.slice(0,3));
