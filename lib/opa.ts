import {z} from 'zod';
import {ageFacts} from './policy-age';
import {evaluate,type Claims,type Policy} from './domain';
import {digest} from './signatures';
export class OpaError extends Error {constructor(){super('OPA 정책 평가에 실패했거나 기존 판정과 일치하지 않습니다. 제출을 저장하지 않았습니다.');}}
export function opaAddress(raw:string|undefined){try{const u=new URL(raw??'');if(u.pathname!=='/'||u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error();return u.origin;}catch{throw new OpaError();}}
const resultSchema=z.object({revision:z.literal('bizproof-eligibility-v1'),binding:z.string().regex(/^[a-f0-9]{64}$/),eligible:z.boolean(),checks:z.object({minRevenue:z.boolean(),maxRevenue:z.boolean(),age:z.boolean(),region:z.boolean(),certification:z.boolean()}).strict()}).strict();
export async function evaluateOpa(claims:Claims,policy:Policy,at:Date,options:{address:string;token?:string;fetcher?:typeof fetch}){
 try{const address=opaAddress(options.address);if(options.token&&/[\r\n]/.test(options.token))throw Error();const local=evaluate(claims,policy,at);const {now,deadline}=ageFacts(claims.foundedOn,policy,at);
 const facts={revenue:claims.revenue,region:claims.region,certified:claims.certified,now,deadline};const conditions={minRevenue:policy.minRevenue,maxRevenue:policy.maxRevenue,region:policy.region,requireCertification:policy.requireCertification};const binding=await digest({context:'bizproof:opa:v1',policy,facts});
 const response=await (options.fetcher??fetch)(address+'/v1/data/bizproof/eligibility/decision',{method:'POST',headers:{'Content-Type':'application/json',...(options.token?{Authorization:'Bearer '+options.token}:{})},body:JSON.stringify({input:{binding,facts,conditions}}),redirect:'error',signal:AbortSignal.timeout(5000)});
 if(!response.ok||!response.body)throw Error();const reader=response.body.getReader();let text='',size=0;const decoder=new TextDecoder();try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000)throw Error();text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
 const result=resultSchema.parse(JSON.parse(text).result);const expected={minRevenue:policy.minRevenue===null||claims.revenue>=policy.minRevenue,maxRevenue:policy.maxRevenue===null||claims.revenue<=policy.maxRevenue,age:deadline===null||now<=deadline,region:!policy.region||claims.region===policy.region,certification:!policy.requireCertification||claims.certified};
 if(result.binding!==binding||result.eligible!==local.eligible||Object.entries(expected).some(([key,value])=>result.checks[key as keyof typeof expected]!==value)||result.eligible!==Object.values(result.checks).every(Boolean))throw Error();return local;
 }catch{throw new OpaError();}
}
