import {jsPDF} from 'jspdf';import {pdfFont} from './pdf-font.ts';import type {Documents} from './documents.ts';
export function renderOfficialPdf(record:Documents['issued'][number],number:string,background?:{bytes:Uint8Array;mime:string}){
 const landscape=record.template.orientation==='landscape';const pdf=new jsPDF({orientation:landscape?'landscape':'portrait',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
 pdf.addFileToVFS('ScoutArabic.ttf',pdfFont);pdf.addFont('ScoutArabic.ttf','ScoutArabic','normal');pdf.setFont('ScoutArabic');pdf.setLanguage('ar-EG');pdf.setR2L(false);pdf.setProperties({title:record.title,subject:number,author:record.groupName,creator:'Mercuri scout'});
 const w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight(),m=record.template.margins;
 const left=Math.max(8,m.left),right=Math.max(8,m.right),width=w-left-right,top=Math.max(12,m.top),bottom=Math.max(12,m.bottom);let y=top;
 if(width<70||h-top-bottom<70)throw Error('الهوامش لا تترك مساحة كافية للمستند');
 function text(line:string,x:number,y:number,size:number){pdf.setFontSize(size);pdf.text(line,x,y,{align:'right'});}
 function page(){if(background){const type=background.mime==='image/png'?'PNG':background.mime==='image/jpeg'?'JPEG':background.mime==='image/webp'?'WEBP':null;if(!type)throw Error('خلفية المستند تحتاج صورة صالحة؛ حوّل PDF إلى خلفية من شاشة القالب');pdf.addImage(background.bytes,type,0,0,w,h);}pdf.setTextColor(20,47,64);text(record.groupName,w-right,top,12);pdf.setFontSize(17);const title=pdf.splitTextToSize(record.title,width) as string[];let titleY=top+11;for(const line of title){text(line,w-right,titleY,17);titleY+=8;}pdf.setDrawColor(185,140,67);pdf.line(left,titleY-2,w-right,titleY-2);y=titleY+7;}
 page();pdf.setFontSize(12);const lines:string[]=[];for(const paragraph of record.body.split('\n')){const split=paragraph?pdf.splitTextToSize(paragraph,width) as string[]:[''];lines.push(...split);}
 for(const line of lines){if(y>h-bottom-14){pdf.addPage();page();}text(line,w-right,y,12);y+=7;}
 const pages=pdf.getNumberOfPages();if(pages>40)throw Error('المستند يتجاوز 40 صفحة؛ استخدم فترة أو نطاقًا أصغر');
 for(let n=1;n<=pages;n++){pdf.setPage(n);pdf.setTextColor(90,105,113);text(number+' · '+record.at.slice(0,10),w-right,h-bottom+3,8);text('صفحة '+n+' من '+pages,left+27,h-bottom+3,8);}
 return {bytes:new Uint8Array(pdf.output('arraybuffer')),pages};
}
