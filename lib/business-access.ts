import {accessConfig} from './openfga-runtime';
import {fgaClient,fgaUser,fgaCompany,FgaError} from './openfga';
import type {State,Role} from './domain';
export type BusinessActor={actor:string;owner:string;authMode:string;role:Role};
export const operational=(actor:{authMode:string})=>actor.authMode==='keycloak';
export async function businessAllowed(actor:BusinessActor,companyId:string,write=false){
 const config=accessConfig();
 if(!config){if(operational(actor))throw new FgaError();return true;}
 return fgaClient(config).check(fgaUser(actor.actor),write?'can_write_business':'can_read_business',fgaCompany(actor.owner,companyId));
}
export async function requireBusinessAccess(actor:BusinessActor,companyId:string,write=false){if(!await businessAllowed(actor,companyId,write))throw new FgaError(403);}
export async function visibleBusinessState(s:State,actor:BusinessActor):Promise<State>{
 if(!operational(actor)&&!accessConfig())return s;
 const allowed=new Set<string>();
 // Bounded batches instead of one request per object or unbounded parallel requests.
 for(let n=0;n<s.companies.length;n+=10)await Promise.all(s.companies.slice(n,n+10).map(async c=>{if(await businessAllowed(actor,c.id))allowed.add(c.id);}));
 const related=<T extends {companyId:string}>(values:T[])=>values.filter(v=>allowed.has(v.companyId));
 const credentials=related(s.credentials),requests=related(s.requests),credentialIds=new Set(credentials.map(c=>c.id)),requestIds=new Set(requests.map(r=>r.id));
 const drafts=related(s.drafts??[]),authorities=related(s.authorities??[]),evidence=related(s.evidence),connections=related(s.connections);
 const targets=new Set([...allowed,...credentialIds,...requestIds,...drafts.map(x=>x.id),...authorities.map(x=>x.id),...evidence.map(x=>x.id),...connections.map(x=>x.id)]);
 return {...s,accessRequests:(s.accessRequests??[]).filter(r=>actor.role==='admin'||r.actor===actor.actor||actor.role==='issuer'&&r.kind==='authority'&&!!r.companyId&&allowed.has(r.companyId)),applicationSubmissions:[],issuanceRequests:related(s.issuanceRequests??[]),companies:s.companies.filter(c=>allowed.has(c.id)),credentials,requests,drafts,authorities,evidence,connections,
 presentations:related(s.presentations),demoJourneys:related(s.demoJourneys??[]),walletEntries:(s.walletEntries??[]).filter(x=>credentialIds.has(x.credentialId)),
 compactRuns:(s.compactRuns??[]).filter(x=>requestIds.has(x.requestId)),issuerSnapshots:[],audit:s.audit.filter(x=>targets.has(x.target)),verifierSessions:[]};
}
export async function guardBusinessAction(s:State,actor:BusinessActor,action:string,body:Record<string,unknown>){
 if(!operational(actor)&&!accessConfig())return;
 const ids=new Set<string>();const add=(id:unknown)=>{if(typeof id==='string')ids.add(id);};
 const from=(arr:{id:string;companyId:string}[],id:unknown)=>{const v=arr.find(x=>x.id===id);if(v)add(v.companyId);};
 add(body.companyId);add((body.data as {companyId?:unknown}|undefined)?.companyId);
 from(s.credentials,body.credentialId);from(s.requests,body.requestId);
 // Existing and proposed company are both checked for draft edits.
 for(const arr of [s.credentials,s.requests,s.presentations,s.drafts??[],s.authorities??[],s.connections,s.companies.map(c=>({id:c.id,companyId:c.id}))])from(arr,body.id);
 if(action==='import-credential')from(s.credentials,(body.credential as {id?:unknown}|undefined)?.id);
 if(Array.isArray(body.ids))for(const id of body.ids)from(s.credentials,id);
 if(['issuer-overview','capture-issuer-state','inspect-issuer-state','rotate-key','issuer-status'].includes(action)){
  const issuerId=body.issuerId??s.issuerSnapshots?.find(x=>x.id===body.id)?.issuerId??body.id;
  for(const c of s.credentials.filter(x=>x.issuerId===issuerId))add(c.companyId);
 }
 if(['create-demo-journey','check-demo-revocation'].includes(action)&&operational(actor))throw new FgaError(403);
 if(action==='create-company'&&operational(actor)&&actor.role!=='admin')throw new FgaError(403);
 const readOnly=new Set(['prepare-application','export-profile','export-portable-credential','inspect-credential','match-request','verify-authority','issuer-overview','inspect-issuer-state','export-midnight-source']);
 for(const id of ids)await requireBusinessAccess(actor,id,!readOnly.has(action));
 // Token verification resolves its subject from the trusted stored credential later; do not expose unrestricted records.
}
