import * as XLSX from 'xlsx';
const header = ['BANDEIRA','LOJA','UF','VISITA SEMANAL','VISITA MENSAL'];
const start = new Date(Date.UTC(2026,5,23));
for(let i=0;i<30;i++){ const d=new Date(start); d.setUTCDate(start.getUTCDate()+i); header.push(d); }
header.push('REALIZADO');
const rows=[header];
const stores=[['ASSAI','ASSAI BRASILIA NORTE','DF',1,4],['CARREFOUR','CARREFOUR ASA SUL','DF',1,4],['ATACADAO','ATACADAO TAGUATINGA','DF',1,4]];
let totalMarks=0;
for(const s of stores){
  const row=[...s]; let marks=0;
  for(let i=0;i<30;i++){ if(i%3===0){ row.push('✅'); marks++; } else row.push(null); }
  row.push(marks); totalMarks+=marks;
  rows.push(row);
}
const ws=XLSX.utils.aoa_to_sheet(rows,{cellDates:true});
const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'KING');
XLSX.writeFile(wb,'/tmp/king.xlsx',{cellDates:true});
console.log('expected marks:', totalMarks);
