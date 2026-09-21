import {createRemoteJWKSet,jwtVerify,EncryptJWT,jwtDecrypt,type JWTVerifyGetKey} from 'jose';
import {z} from 'zod';
import type {Role} from './domain';
export const businessRoles:Role[]=['admin','issuer','company','buyer','grant'];
export type KeycloakConfig={issuer:string;clientId:string;origin:string;secret:Uint8Array};
export function keycloakConfig(values:{issuer?:string;clientId?:string;origin?:string;secret?:string}):KeycloakConfig{
 const endpoint=(raw:string|undefined)=>{const u=new URL(raw??'');if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error('Invalid identity endpoint');return u;};
 const issuer=endpoint(values.issuer),origin=endpoint(values.origin);if(!/^\/realms\/[A-Za-z0-9_-]+$/.test(issuer.pathname)||origin.pathname!=='/'||!values.clientId||!/^[A-Za-z0-9_-]{1,100}$/.test(values.clientId)||!values.secret||!/^[a-f0-9]{64}$/i.test(values.secret))throw Error('Invalid identity configuration');
 return {issuer:issuer.href.replace(/\/$/,''),origin:origin.origin,clientId:values.clientId,secret:Uint8Array.from(values.secret.match(/../g)!,v=>parseInt(v,16))};
}
export function safeReturn(value:string|null){try{const u=new URL(value??'/', 'https://app.local');if(!value?.startsWith('/')||u.origin!=='https://app.local'||value.length>1000||u.pathname.startsWith('/api/')||['/callback','/signin-with-chatgpt','/signout-with-chatgpt'].includes(u.pathname))return '/';return u.pathname+u.search+u.hash;}catch{return '/';}}
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const random=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
const flowSchema=z.object({state:z.string().length(43),nonce:z.string().length(43),verifier:z.string().length(43),returnTo:z.string().max(1000)});
export async function startLogin(config:KeycloakConfig,returnTo:string|null){
 const flow={state:random(),nonce:random(),verifier:random(),returnTo:safeReturn(returnTo)};
 const cookie=await new EncryptJWT(flow).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setIssuer(config.origin).setAudience('bizproof:oidc-flow').setIssuedAt().setExpirationTime('10m').encrypt(config.secret);
 const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(flow.verifier))));
 const url=new URL(config.issuer+'/protocol/openid-connect/auth');url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.origin+'/api/auth/callback',response_type:'code',scope:'openid profile email',state:flow.state,nonce:flow.nonce,code_challenge:challenge,code_challenge_method:'S256'}).toString();
 return {cookie,url:url.href};
}
export async function loginFlow(config:KeycloakConfig,cookie:string,state:string){const decrypted=await jwtDecrypt(cookie,config.secret,{issuer:config.origin,audience:'bizproof:oidc-flow',keyManagementAlgorithms:['dir'],contentEncryptionAlgorithms:['A256GCM'],maxTokenAge:'10m'});const flow=flowSchema.parse(decrypted.payload);if(flow.state!==state)throw Error('Login state mismatch');return flow;}
const keySets=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
function remoteKeys(config:KeycloakConfig){let keys=keySets.get(config.issuer);if(!keys){keys=createRemoteJWKSet(new URL(config.issuer+'/protocol/openid-connect/certs'),{timeoutDuration:5000,cacheMaxAge:300000});keySets.set(config.issuer,keys);}return keys;}
export async function validateAccess(config:KeycloakConfig,token:string,keys:JWTVerifyGetKey=remoteKeys(config)){
 const {payload}=await jwtVerify(token,keys,{issuer:config.issuer,audience:config.clientId,algorithms:['RS256'],requiredClaims:['sub','iat','exp','azp','typ'],maxTokenAge:'5m'});
 if(payload.azp!==config.clientId||payload.typ!=='Bearer'||typeof payload.sub!=='string'||!payload.sub.length)throw Error('Invalid access token');
 const resource=z.record(z.object({roles:z.array(z.string())}).passthrough()).parse(payload.resource_access??{});
 const assigned=resource[config.clientId]?.roles??[],allowedRoles=businessRoles.filter(r=>assigned.includes(r));if(!allowedRoles.length)throw Error('No assigned business role');
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(config.issuer+'\n'+payload.sub)));
 return {userId:'keycloak:'+encode(hash),displayName:typeof payload.name==='string'?payload.name:typeof payload.preferred_username==='string'?payload.preferred_username:payload.sub,email:typeof payload.email==='string'?payload.email:'',fullName:typeof payload.name==='string'?payload.name:null,allowedRoles,authMode:'keycloak' as const,expiresAt:payload.exp!};
}
export async function validateId(config:KeycloakConfig,token:string,nonce:string,subject:string,keys:JWTVerifyGetKey=remoteKeys(config)){
 const {payload}=await jwtVerify(token,keys,{issuer:config.issuer,audience:config.clientId,algorithms:['RS256'],requiredClaims:['sub','iat','exp','nonce'],maxTokenAge:'5m'});
 if(payload.nonce!==nonce||payload.sub!==subject||(payload.azp!==undefined&&payload.azp!==config.clientId)||(Array.isArray(payload.aud)&&payload.aud.length>1&&payload.azp!==config.clientId))throw Error('ID token binding mismatch');
}
export async function finishLogin(config:KeycloakConfig,cookie:string,state:string,code:string,fetcher:typeof fetch=fetch,keys:JWTVerifyGetKey=remoteKeys(config)){
 const flow=await loginFlow(config,cookie,state);if(!code||code.length>4000)throw Error('Invalid authorization code');
 const response=await fetcher(config.issuer+'/protocol/openid-connect/token',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:config.clientId,redirect_uri:config.origin+'/api/auth/callback',code,code_verifier:flow.verifier})});
 if(!response.ok)throw Error('Token exchange failed');
 const body=z.object({access_token:z.string().max(3500),id_token:z.string().max(12000),token_type:z.literal('Bearer')}).parse(await response.json());
 const user=await validateAccess(config,body.access_token,keys);
 const {payload}=await jwtVerify(body.access_token,keys,{issuer:config.issuer,audience:config.clientId,algorithms:['RS256']});
 await validateId(config,body.id_token,flow.nonce,payload.sub!,keys);
 return {token:body.access_token,user,returnTo:safeReturn(flow.returnTo)};
}
export function selectRole(allowedRoles:Role[],requested:string|undefined):Role|null{return allowedRoles.find(r=>r===requested)??allowedRoles[0]??null;}
