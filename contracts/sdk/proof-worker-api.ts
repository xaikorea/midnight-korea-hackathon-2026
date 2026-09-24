import {readFile} from 'node:fs/promises';
import {createHmac,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {sourceHash,publicSigningKey} from './issued-source.ts';
import {sourceCanonical} from './web-source.ts';
const publicPin=z.object({keyId:z.string(),publicKey:publicSigningKey}).strict();
export const executorConfigSchema=z.object({origin:z.string().url(),secret:z.string().min(48),pins:z.object({platform:publicPin,issuer:publicPin.extend({issuerId:z.string()})}).strict()}).strict();
export const verifierConfigSchema=z.object({origin:z.string().url(),secret:z.string().min(48),key:z.object({kty:z.literal('OKP'),crv:z.literal('Ed25519'),x:z.string(),d:z.string()}).strict()}).strict();
export async function readWorkerConfig(role:'executor'):Promise<z.infer<typeof executorConfigSchema>>;
export async function readWorkerConfig(role:'verifier'):Promise<z.infer<typeof verifierConfigSchema>>;
export async function readWorkerConfig(role:'executor'|'verifier'){
 const path=process.env.BIZPROOF_PROOF_CONFIG;if(!path)throw Error('BIZPROOF_PROOF_CONFIG must reference a private local configuration file');const raw=JSON.parse(await readFile(path,'utf8'));
 return role==='executor'?executorConfigSchema.parse(raw):verifierConfigSchema.parse(raw);
}
export function proofWorkerApi(config:{origin:string;secret:string},role:'executor'|'verifier'){
 const url=new URL(config.origin);if(url.origin!==config.origin||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Use a fixed HTTPS origin or local loopback');
 // Serializes commands with heartbeat so optimistic job revisions cannot race within this worker.
 let queue:Promise<unknown>=Promise.resolve();
 return <T=unknown>(body:unknown):Promise<T>=>{
  const task=queue.then(async()=>{const iat=Date.now(),payload={aud:'bizproof-proof-'+role,worker:'local-devnet-1',method:'POST',path:'/api/proof-worker',bodyHash:await sourceHash(body),iat,exp:iat+30000,jti:randomUUID()},encoded=Buffer.from(sourceCanonical(payload)).toString('base64url'),token=encoded+'.'+createHmac('sha256',config.secret).update(encoded).digest('base64url');
   const r=await fetch(url.origin+'/api/proof-worker',{method:'POST',headers:{'Content-Type':'application/json','x-bizproof-worker-role':role,Authorization:'BizProof '+token},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(25000)});const response=await r.json() as T&{error?:string};if(!r.ok)throw Error('Worker API '+r.status+': '+(response.error??'request rejected'));return response;
  });queue=task.catch(()=>{});return task;
 };
}
