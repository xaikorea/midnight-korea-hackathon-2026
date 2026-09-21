import {z} from 'zod';
import type {Role} from './domain';
export class FgaError extends Error{constructor(public status=503){super(status===403?'이 리소스에 대한 권한이 없습니다.':'관계 기반 권한 서버를 확인할 수 없습니다. 접근을 허용하지 않았습니다.');}}
const ulid=z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export function fgaConfig(input:{mode?:string;address?:string;storeId?:string;modelId?:string;token?:string}){
 if(!input.mode||input.mode==='local')return null;
 try{if(input.mode!=='openfga')throw Error();const u=new URL(input.address??'');if(u.username||u.password||u.pathname!=='/'||u.search||u.hash||!(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))||input.token&&/[\r\n]/.test(input.token))throw Error();return {address:u.origin,storeId:ulid.parse(input.storeId),modelId:ulid.parse(input.modelId),token:input.token};}catch{throw new FgaError();}
}
// Encode the complete identity; delimiters in a subject/tenant can never create a userset.
function encoded(values:string[]){if(values.some(x=>!x||x.length>512))throw new FgaError();return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(values)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
export const fgaUser=(id:string)=>'user:'+encoded([id]);
export const fgaWorkspace=(owner:string)=>'workspace:'+encoded([owner]);
export const fgaCompany=(owner:string,id:string)=>'company:'+encoded([owner,id]);
export function fgaClient(config:NonNullable<ReturnType<typeof fgaConfig>>,fetcher:typeof fetch=fetch){return {async check(user:string,relation:string,object:string){
 try{const response=await fetcher(config.address+`/stores/${config.storeId}/check`,{method:'POST',headers:{'Content-Type':'application/json',...(config.token?{Authorization:'Bearer '+config.token}:{})},body:JSON.stringify({authorization_model_id:config.modelId,tuple_key:{user,relation,object},consistency:'HIGHER_CONSISTENCY'}),redirect:'error',signal:AbortSignal.timeout(5000)});if(!response.ok||!response.body)throw Error();const reader=response.body.getReader();let text='',size=0;const decoder=new TextDecoder();try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000)throw Error();text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}return z.object({allowed:z.boolean()}).parse(JSON.parse(text)).allowed;}catch{throw new FgaError();}
 }};}
export async function intersectFgaRoles(user:{userId:string;storageOwner:string;authMode:string;allowedRoles:Role[]},config:ReturnType<typeof fgaConfig>,fetcher?:typeof fetch){if(!config)return user.allowedRoles;if(user.authMode!=='keycloak')throw new FgaError(403);const client=fgaClient(config,fetcher);const decisions=await Promise.all(user.allowedRoles.map(role=>client.check(fgaUser(user.userId),role,fgaWorkspace(user.storageOwner))));return user.allowedRoles.filter((_,i)=>decisions[i]);}
