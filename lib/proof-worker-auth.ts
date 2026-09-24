import {z} from 'zod';
import {verifyAuthorization} from '../services/issuer/protocol.mjs';
import {binding} from './store';
import {digest} from './signatures';
import {ProofJobError} from './proof-jobs';
export async function authenticateProofWorker(req:Request,body:unknown){
 const role=req.headers.get('x-bizproof-worker-role');if(role!=='executor'&&role!=='verifier')throw new ProofJobError(401,'실행기 인증이 필요합니다.');
 const secret=process.env[role==='executor'?'BIZPROOF_PROOF_WORKER_SECRET':'BIZPROOF_PROOF_VERIFIER_SECRET'];
 if(!secret||secret.length<48)throw new ProofJobError(503,'실행기를 아직 설정하지 않았습니다.');
 try{
  const b=z.object({aud:z.literal('bizproof-proof-'+role),worker:z.literal('local-devnet-1'),method:z.literal('POST'),path:z.literal('/api/proof-worker'),bodyHash:z.string(),iat:z.number(),exp:z.number(),jti:z.string().uuid()}).strict().parse(verifyAuthorization(secret,(req.headers.get('authorization')??'').replace(/^BizProof /,'')));
  if(b.bodyHash!==await digest(body)||b.iat>Date.now()+5000||b.iat<Date.now()-30000||b.exp<=Date.now()||b.exp-b.iat>30000||b.exp<=b.iat)throw Error('Expired request');
  await binding().prepare('CREATE TABLE IF NOT EXISTS proof_worker_tokens(jti TEXT PRIMARY KEY,expires INTEGER NOT NULL)').run();
  await binding().prepare('DELETE FROM proof_worker_tokens WHERE expires<?').bind(Date.now()-60000).run();
  await binding().prepare('INSERT INTO proof_worker_tokens(jti,expires) VALUES (?,?)').bind(b.jti,b.exp).run();return {role,worker:b.worker};
 }catch{throw new ProofJobError(401,'실행기 인증 또는 재사용 방지 검증에 실패했습니다.');}
}
