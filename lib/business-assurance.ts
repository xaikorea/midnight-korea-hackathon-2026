import {z} from 'zod';
import type {Credential,State,Authority} from './domain';
const reviewed=z.object({kind:z.literal('document-review'),reference:z.string().min(3),period:z.string().min(3),method:z.string().min(5),reviewer:z.string().min(1),reviewedAt:z.string().datetime(),documents:z.array(z.object({id:z.string().min(1),name:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/)})).min(1).max(10)});
export function requireReviewedCredential(s:State,c:Credential){
 const parsed=reviewed.safeParse(c.source);
 if(!parsed.success||parsed.data.documents.some(d=>!s.evidence.some(e=>e.id===d.id&&e.companyId===c.companyId&&e.sha256===d.sha256)))throw Error('운영 자격에는 원본 증빙과 연결된 문서 검토 기록이 필요합니다. 증빙을 검토해 새 자격을 발급하세요.');
}
export function requireAuthorityActor(a:Authority|undefined,actor:string|undefined){
 if(!a||!actor||!a.holderUserId||a.holderUserId!==actor)throw Error('로그인 사용자에게 발급된 담당자 권한이 필요합니다.');
}
