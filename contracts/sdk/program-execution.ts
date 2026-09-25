import {z} from 'zod';
import {numericPolicySchema,programOriginalSchema} from './program-source.ts';
import {publicSigningKey,verifySigned,sourceHash} from './issued-source.ts';
import {sourceCanonical} from './web-source.ts';
import {jobReceiptSchema} from './proof-job-protocol.ts';
const hex=z.string().regex(/^[a-f0-9]{64}$/),text=z.string().min(1).max(200),uint=z.number().int().nonnegative().max(1e15);
export const programIds=['seongsu-2026-h2','ai-hub-2026-leading','gongdeok-2026-h1','hyundai-steel-technical','posco-sourcing','sk-hynix-supplier'] as const;
export const programBindingSchema=z.object({jobId:z.string().uuid(),applicationId:z.string().uuid(),companyId:text,registration:text,actor:text,profileId:z.enum(programIds),profileHash:hex,sourceDigest:hex,requestId:hex,nonce:hex,audience:hex,contractAddress:hex,holder:hex,issuedAt:uint,deadline:uint,policy:numericPolicySchema,coverage:z.array(z.enum(['finance-or','residents','general-age','new-industry-age','credential-binding'])).min(1).max(3),claims:z.object({revenue:uint,fiscalYear:uint.max(65535),investment:uint,plannedResidents:uint.max(1000000),foundedDay:uint.max(4294967295),companyCommitment:hex,bundleDigest:hex,credentialId:hex,issuedAt:uint,expiresAt:uint}).strict(),eligible:z.boolean(),fullEligibility:z.literal(false)}).strict();
export type ProgramBinding=z.infer<typeof programBindingSchema>;
export const executionSourceSchema=z.object({body:z.object({context:z.literal('bizproof:program-execution-source:2'),network:z.literal('undeployed'),issuedAt:uint,expiresAt:uint,binding:programBindingSchema,originals:z.array(programOriginalSchema).min(1).max(10),documents:z.array(z.object({id:text,sha256:hex}).strict()).min(1).max(30),issuers:z.array(z.object({issuerId:text,keyId:text,publicKey:publicSigningKey,facts:z.array(text).max(20),active:z.literal(true)}).strict()).min(1).max(10),trust:z.literal('platform-delegated-synthetic-issuers')}).strict(),signature:z.string().min(80).max(100)}).strict();
export const programTaskSchema=z.object({jobId:z.string().uuid(),binding:programBindingSchema,receipts:z.array(jobReceiptSchema).min(1).max(12),challenge:z.string().uuid()}).strict();
export const programVerificationSchema=z.object({context:z.literal('bizproof:program-verification:2'),jobId:z.string().uuid(),challenge:z.string().uuid(),taskDigest:hex,contractAddress:hex,requestId:hex,sourceDigest:hex,network:z.literal('undeployed'),eligible:z.boolean(),fullEligibility:z.literal(false),contractCodeVerified:z.literal(true),receiptsVerified:z.number().int().min(5).max(12),checkedAt:z.string().datetime()}).strict();
export function programPolicy(profileId:typeof programIds[number],newIndustry:boolean){
 const policy={minRevenue:0,minInvestment:0,fiscalYear:0,requireFinance:false,minResidents:0,minFoundedDay:0,maxFoundedDay:4294967295,issuerId:1};
 let coverage:ProgramBinding['coverage']=['credential-binding'];
 if(profileId==='ai-hub-2026-leading'){Object.assign(policy,{minRevenue:2_000_000_000,minInvestment:3_000_000_000,fiscalYear:2025,requireFinance:true,minResidents:15});coverage=['finance-or','residents'];}
 if(profileId==='seongsu-2026-h2'||profileId==='gongdeok-2026-h1'){
  const reference=profileId==='seongsu-2026-h2'?'2026-09-03':'2026-06-10',cutoff=new Date(reference+'T00:00:00Z');cutoff.setUTCFullYear(cutoff.getUTCFullYear()-(newIndustry?10:7));
  policy.minFoundedDay=Math.floor(cutoff.getTime()/864e5)+(!newIndustry&&profileId==='seongsu-2026-h2'?1:0);policy.maxFoundedDay=Math.floor(Date.parse(reference)/864e5);coverage=[newIndustry?'new-industry-age':'general-age'];
 }
 return {policy,coverage};
}
export async function deriveProgramBinding(input:Omit<ProgramBinding,'policy'|'coverage'|'claims'|'eligible'|'fullEligibility'>,originals:z.infer<typeof programOriginalSchema>[]){
 const fact=(name:string,required=true):unknown=>{const values=originals.flatMap(c=>Object.entries(c.facts).filter(([key])=>key===name).map(([,v])=>v));if(!values.length&&!required)return undefined;if(!values.length||new Set(values.map(sourceCanonical)).size!==1)throw Error('Missing or conflicting fact: '+name);return values[0];};
 if(fact('registered')!==true)throw Error('A signed registered company credential is required');
 const {policy,coverage}=programPolicy(input.profileId,fact('newIndustry',false)===true),finance=policy.requireFinance,age=policy.maxFoundedDay!==4294967295;
 const number=(name:string)=>{const v=fact(name);if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)throw Error('Invalid numeric fact');return v;};
 // Zero is a circuit placeholder only when its predicate is disabled. It never fills an unknown checked fact.
 const revenue=finance?number('revenueKrw'):0,fiscalYear=finance?number('fiscalYear'):0,investment=finance?number('investmentKrw'):0,plannedResidents=finance?number('plannedResidents'):0;
 if(finance&&!originals.some(c=>c.facts.revenueKrw===revenue&&c.facts.fiscalYear===fiscalYear))throw Error('Unbound revenue fiscal year');
 const founded=age?fact('foundedOn'):undefined;if(age&&typeof founded!=='string')throw Error('Missing founded date');
 const foundedDay=age?Math.floor(Date.parse(founded as string)/864e5):0;
 const companyCommitment=await sourceHash({companyId:input.companyId,registration:input.registration}),bundleDigest=await sourceHash(originals);
 if(bundleDigest!==input.sourceDigest||input.deadline<=input.issuedAt||input.deadline-input.issuedAt>5400)throw Error('Invalid source digest or execution consent');
 const claims={revenue,fiscalYear,investment,plannedResidents,foundedDay,companyCommitment,bundleDigest,credentialId:await sourceHash({context:'bizproof:program-execution:2',jobId:input.jobId,bundleDigest}),issuedAt:input.issuedAt,expiresAt:input.deadline};
 const eligible=(!finance||(fiscalYear===policy.fiscalYear&&revenue>=policy.minRevenue)||investment>=policy.minInvestment)&&plannedResidents>=policy.minResidents&&foundedDay>=policy.minFoundedDay&&foundedDay<=policy.maxFoundedDay;
 return programBindingSchema.parse({...input,claims,policy,coverage,eligible,fullEligibility:false});
}
export async function verifyProgramExecution(raw:unknown,platform:JsonWebKey,expected:{jobId:string;sourceDigest:string;holder:string;contractAddress:string},now=Math.floor(Date.now()/1000)){
 const source=executionSourceSchema.parse(raw),b=source.body,binding=b.binding;
 await verifySigned(platform,b,source.signature);
 if(b.issuedAt>now||b.expiresAt<=now||b.expiresAt-b.issuedAt>300||b.expiresAt>binding.deadline||binding.deadline<=now||binding.issuedAt>now||Object.entries(expected).some(([k,v])=>binding[k as keyof ProgramBinding]!==v))throw Error('Wrong execution target or expired source');
 if(new Set(b.originals.map(c=>c.id)).size!==b.originals.length||new Set(b.issuers.map(i=>i.issuerId)).size!==b.issuers.length||new Set(b.documents.map(d=>d.id)).size!==b.documents.length)throw Error('Duplicate source identifiers');
 for(const c of b.originals){const pin=b.issuers.find(i=>i.issuerId===c.issuerId&&i.keyId===c.keyId);if(!pin||c.companyId!==binding.companyId||c.registration!==binding.registration||Object.keys(c.facts).some(k=>!pin.facts.includes(k))||Date.parse(c.issuedAt)>now*1000||Date.parse(c.expiresAt)<binding.deadline*1000||c.evidence.some(e=>!b.documents.some(d=>d.id===e.id&&d.sha256===e.sha256)))throw Error('Untrusted synthetic issuer, credential or evidence');
  const body=Object.fromEntries(Object.entries(c).filter(([key])=>!['status','signature'].includes(key)));await verifySigned(pin.publicKey,{context:'bizproof:program-credential:1',body},c.signature);
 }
 const derived=await deriveProgramBinding(binding,b.originals);if(sourceCanonical(derived)!==sourceCanonical(binding))throw Error('Execution claims or policy differ from signed originals');return binding;
}
