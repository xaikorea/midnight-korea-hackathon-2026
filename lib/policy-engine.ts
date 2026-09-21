import {env} from 'cloudflare:workers';
import {evaluate,type Claims,type Policy} from './domain';
import {evaluateOpa,OpaError,opaAddress} from './opa';
export function policyEngineMode(){if(!env.BIZPROOF_POLICY_ENGINE||env.BIZPROOF_POLICY_ENGINE==='local')return 'local';if(env.BIZPROOF_POLICY_ENGINE==='opa')return 'opa';throw new OpaError();}
export function policyEngineStatus(){const mode=policyEngineMode();if(mode==='opa')opaAddress(env.OPA_ADDR);return {mode,revision:'bizproof-eligibility-v1',remoteExecutionVerified:false};}
export async function evaluateSubmission(claims:Claims,policy:Policy,at=new Date()){return policyEngineMode()==='local'?evaluate(claims,policy,at):evaluateOpa(claims,policy,at,{address:env.OPA_ADDR??'',token:env.OPA_TOKEN});}
