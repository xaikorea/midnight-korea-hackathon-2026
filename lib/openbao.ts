import {z} from 'zod';
export class OpenBaoError extends Error {constructor(){super('OpenBao 설정·연결·권한 또는 암호문을 확인하세요. 평문 저장으로 전환하지 않았습니다.');}}
export type BaoConfig={address:string;token:string;mount:string;key:string};
export function baoConfig(v:{address?:string;token?:string;mount?:string;key?:string}):BaoConfig{
 try{const u=new URL(v.address??'');if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error();
 const mount=v.mount??'transit',key=v.key??'bizproof-workspaces';if(!/^[a-zA-Z0-9_-]+$/.test(mount)||!/^bizproof-[a-zA-Z0-9_-]+$/.test(key)||!v.token||v.token.length>4096||/[\s\r\n]/.test(v.token))throw Error();return {address:u.origin,token:v.token,mount,key};}catch{throw new OpenBaoError();}
}
const maxBytes=1_500_000;
const cipher=z.string().max(maxBytes).regex(/^vault:v[1-9]\d*:[A-Za-z0-9+/]+={0,2}$/);
export const envelopeSchema=z.object({format:z.literal('bizproof-openbao-v1'),mount:z.string(),key:z.string(),ciphertext:cipher}).strict();
export type BaoEnvelope=z.infer<typeof envelopeSchema>;
function b64(bytes:Uint8Array){let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);}
async function context(owner:string){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('bizproof:workspace:v1\n'+owner))));}
async function boundedJson(response:Response){if(!response.ok||!response.body)throw new OpenBaoError();const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new OpenBaoError();parts.push(value);}}finally{await reader.cancel();}const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
export function baoClient(config:BaoConfig,fetcher:typeof fetch=fetch){
 async function call(path:string,body?:unknown){try{return await boundedJson(await fetcher(config.address+'/v1/'+config.mount+'/'+path,{method:body?'POST':'GET',headers:{'X-Vault-Token':config.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(8000)}));}catch{throw new OpenBaoError();}}
 async function metadata(){try{const result=z.object({data:z.object({type:z.literal('aes256-gcm96'),derived:z.literal(true),exportable:z.literal(false),allow_plaintext_backup:z.literal(false),latest_version:z.number().int().positive()})}).parse(await call('keys/'+config.key));return {latestVersion:result.data.latest_version};}catch{throw new OpenBaoError();}}
 function check(input:unknown){const e=envelopeSchema.parse(input);if(e.key!==config.key||e.mount!==config.mount)throw new OpenBaoError();return e;}
 const envelope=(value:unknown):BaoEnvelope=>({format:'bizproof-openbao-v1',mount:config.mount,key:config.key,ciphertext:cipher.parse(value)});
 return {metadata,
  async encrypt(owner:string,plaintext:string){try{const bytes=new TextEncoder().encode(plaintext);if(bytes.length>900_000)throw new OpenBaoError();await metadata();const r=await call('encrypt/'+config.key,{plaintext:b64(bytes),context:await context(owner)});return envelope(r.data?.ciphertext);}catch{throw new OpenBaoError();}},
  async decrypt(owner:string,input:unknown){try{const e=check(input);const r=await call('decrypt/'+config.key,{ciphertext:e.ciphertext,context:await context(owner)});const encoded=z.string().max(maxBytes).parse(r.data?.plaintext);return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));}catch{throw new OpenBaoError();}},
  async rewrap(owner:string,input:unknown){try{const e=check(input);await metadata();const r=await call('rewrap/'+config.key,{ciphertext:e.ciphertext,context:await context(owner)});return envelope(r.data?.ciphertext);}catch{throw new OpenBaoError();}}
 };
}
