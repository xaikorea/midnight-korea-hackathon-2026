import {z} from 'zod';
import {type State,type CredentialSource} from './domain';
export const sourceInput=z.object({reference:z.string().trim().min(3).max(200),period:z.string().trim().min(3).max(100),method:z.string().trim().min(5).max(500),evidenceIds:z.array(z.string().min(1)).min(1).max(10),confirmed:z.literal(true)});
export async function reviewSource(s:State,companyId:string,raw:unknown,reviewer:string,read:(key:string)=>Promise<ArrayBuffer|null>):Promise<CredentialSource>{
 const input=sourceInput.parse(raw);const documents=[];
 for(const id of [...new Set(input.evidenceIds)]){const f=s.evidence.find(f=>f.id===id);if(!f||f.companyId!==companyId)throw Error('해당 기업의 증빙만 검토할 수 있습니다.');const bytes=await read(f.key);if(!bytes)throw Error('증빙 원본을 읽을 수 없습니다.');const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');if(f.sha256&&f.sha256!==sha256)throw Error('저장된 증빙 해시가 일치하지 않습니다.');documents.push({id:f.id,name:f.name,sha256});}
 return {kind:'document-review',reference:input.reference,period:input.period,method:input.method,reviewer,reviewedAt:new Date().toISOString(),documents,notice:'담당자의 문서 검토 기록입니다. 공공기관 확인 또는 문서 내용의 진위를 자동으로 인증하지 않습니다.'};
}
