import type {State} from './domain';
import {findProgram} from './program-catalog';
import {precheckProgram} from './program-rules';
import {applicationReceiptPayload,ProgramError} from './program-service';
import {digest,sign,verify} from './signatures';
import {programSourceSchema,verifyProgramNumericSource} from '../contracts/sdk/program-source.ts';

// Internal/local source preparation only. No browser export route or remote execution is enabled.
// A future worker must obtain a fresh execution consent and pin keys independently at its destination.
export async function prepareProgramNumericSource(state:State,applicationId:string,target:{actor:string;contractAddress:string;holder:string},readDocument:(key:string)=>Promise<ArrayBuffer|null>,now=new Date()){
 const data=state.programData,application=data?.applications.find(a=>a.id===applicationId);
 if(!data||!application||application.actor!==target.actor||application.mode!=='synthetic'||application.profile.id!=='ai-hub-2026-leading')throw new ProgramError('이 신청은 수치 회로 연결 대상이 아닙니다.',403);
 const approvedProfile=findProgram(application.profile.id),company=state.companies.find(c=>c.id===application.companyId);
 if(!company||!approvedProfile||await digest(approvedProfile)!==application.precheck.profileHash||await digest(application.profile)!==application.precheck.profileHash||!await verify(data.receiptKey.publicKey,applicationReceiptPayload(application),application.receipt.signature))throw new ProgramError('보존된 신청·프로필 서명을 확인할 수 없습니다.');
 const verifiedDocuments=new Set<string>();
 for(const reference of application.precheck.documents){const document=data.documents.find(d=>d.id===reference.id);if(!document||document.companyId!==company.id)throw new ProgramError('신청에 연결된 증빙이 없습니다.');const bytes=await readDocument(document.key);if(!bytes)throw new ProgramError('신청 원본 증빙이 없습니다.');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(hash!==reference.sha256||hash!==document.sha256)throw new ProgramError('증빙 내용이 변경되었습니다.');verifiedDocuments.add(document.id);}
 const current=await precheckProgram({data,company,profile:approvedProfile,verifiedDocuments,now});
 if(current.fingerprint!==application.precheck.fingerprint)throw new ProgramError('현재 자격 상태와 신청 당시 상태가 다릅니다. 새 확인이 필요합니다.',409);
 const originals=data.credentials.filter(c=>current.credentialDigests.some(d=>d.id===c.id));
 const issuedAt=Math.floor(now.getTime()/1000),expiresAt=Math.min(issuedAt+300,Math.floor(Date.parse(application.consent.body.expiresAt)/1000),...originals.map(c=>Math.floor(Date.parse(c.expiresAt)/1000)));
 if(expiresAt<=issuedAt)throw new ProgramError('내부 준비 동의가 만료되었습니다. 새 사전검사와 동의가 필요합니다.',409);
 const body=programSourceSchema.shape.body.parse({context:'bizproof:program-numeric-source:1',network:'undeployed',applicationId,companyId:company.id,registration:company.registration,actor:target.actor,profileId:approvedProfile.id,profileHash:current.profileHash,nonce:await digest(application.consent.body.nonce),holder:target.holder,contractAddress:target.contractAddress,issuedAt,expiresAt,policy:{minRevenue:2_000_000_000,minInvestment:3_000_000_000,fiscalYear:2025,requireFinance:true,minResidents:15,minFoundedDay:0,maxFoundedDay:4294967295,issuerId:1},originals,documents:current.documents,coverage:['finance-or','residents'],fullEligibility:false});
 const source={body,signature:await sign(data.receiptKey.privateKey,body)};
 const pins={platform:data.receiptKey.publicKey,issuers:data.issuers.map(i=>({issuerId:i.id,keyId:i.keyId,publicKey:i.publicKey,facts:i.facts,active:i.status==='active'}))};
 await verifyProgramNumericSource(source,pins,body,async id=>data.credentials.find(c=>c.id===id)?.status??'unknown',issuedAt);
 return source;
}
