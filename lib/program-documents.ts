import {PDFDocument,PDFName,PDFDict,StandardFonts,rgb} from 'pdf-lib';
export class ProgramDocumentError extends Error{constructor(message:string,public status=422){super(message);}}
export const programFileLimit=20*1024*1024;
export async function inspectProgramPdf(bytes:ArrayBuffer){
 if(!bytes.byteLength||bytes.byteLength>programFileLimit)throw new ProgramDocumentError('PDF는 비어 있지 않은 20MB 이하 파일이어야 합니다.');
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new ProgramDocumentError('실제 PDF 형식의 파일이 필요합니다.');
 let pdf:PDFDocument;try{pdf=await PDFDocument.load(bytes,{updateMetadata:false,throwOnInvalidObject:true});}catch{throw new ProgramDocumentError('PDF 구조 또는 암호화 상태를 확인하세요.');}
 if(pdf.isEncrypted)throw new ProgramDocumentError('암호화된 PDF는 검사할 수 없습니다.');
 for(const [,object] of pdf.context.enumerateIndirectObjects())if(object instanceof PDFDict){
  if(['JavaScript','JS','OpenAction','AA','EmbeddedFiles','RichMediaContent'].some(k=>object.has(PDFName.of(k))))throw new ProgramDocumentError('스크립트·자동 실행·첨부 기능이 있는 PDF는 허용되지 않습니다.');
 }
 const pages=pdf.getPageCount();if(pages<1||pages>200)throw new ProgramDocumentError('PDF는 1~200쪽이어야 합니다. 사업별 페이지 제한도 별도로 확인합니다.');
 return {pages};
}
export async function syntheticProgramPdf(companyId:string,type:string,pages=1,lines:string[]=[]){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 pdf.setTitle('BizProof synthetic demonstration - '+type);
 for(let n=0;n<pages;n++){const page=pdf.addPage([595,842]);page.drawText('SYNTHETIC DEMO - NOT AN OFFICIAL DOCUMENT',{x:35,y:780,size:14,font,color:rgb(.1,.3,.6)});page.drawText('BizProof / '+type,{x:35,y:735,size:18,font});page.drawText(companyId,{x:35,y:700,size:10,font});page.drawText(`Page ${n+1} / ${pages}. No real company or personal data.`,{x:35,y:650,size:12,font});for(const [index,line] of lines.slice(0,24).entries())page.drawText(line.replace(/[^\x20-\x7E]/g,'?').slice(0,90),{x:35,y:610-index*20,size:11,font});}
 return new Uint8Array(await pdf.save()).buffer;
}
export async function readBoundedBody(request:Request,limit:number){
 if(Number(request.headers.get('content-length')??0)>limit)throw new ProgramDocumentError('요청 용량 한도를 초과했습니다.',413);
 const reader=request.body?.getReader();if(!reader)throw new ProgramDocumentError('요청 내용이 없습니다.');
 const chunks:Uint8Array[]= [];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new ProgramDocumentError('요청 용량 한도를 초과했습니다.',413);chunks.push(value);}}finally{await reader.cancel();}
 const result=new Uint8Array(size);let at=0;for(const c of chunks){result.set(c,at);at+=c.length;}return result.buffer;
}
