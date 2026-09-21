import {env} from 'cloudflare:workers';
import {baoClient,baoConfig,OpenBaoError,envelopeSchema} from './openbao';
export function protectionMode(){if(!env.BIZPROOF_STORAGE_PROTECTION||env.BIZPROOF_STORAGE_PROTECTION==='demo')return 'demo';if(env.BIZPROOF_STORAGE_PROTECTION==='openbao')return 'openbao';throw new OpenBaoError();}
export function storageClient(){return baoClient(baoConfig({address:env.OPENBAO_ADDR,token:env.OPENBAO_TOKEN,mount:env.OPENBAO_TRANSIT_MOUNT,key:env.OPENBAO_TRANSIT_KEY}));}
export function storageEnvelope(payload:string){const value=JSON.parse(payload);if(value&&typeof value==='object'&&'format' in value)return envelopeSchema.parse(value);return null;}
export async function encodeStorage(owner:string,plaintext:string){return protectionMode()==='openbao'?JSON.stringify(await storageClient().encrypt(owner,plaintext)):plaintext;}
export async function decodeStorage(owner:string,payload:string){const mode=protectionMode(),e=storageEnvelope(payload);if(!e)return payload;if(mode!=='openbao')throw new OpenBaoError();return storageClient().decrypt(owner,e);}
