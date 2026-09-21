// SignifyClient is injected so offline fixtures never masquerade as a live KERIA agent.
const qb64 = /^[A-Za-z0-9_-]{44}$/;
export function identifier(value) {
  if (typeof value !== 'string' || !qb64.test(value)) throw Error('Invalid AID/SAID');
  return value;
}
export function adminOrigin(value) {
  const u = new URL(value);
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/' ||
      !(u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname)))) throw Error('HTTPS or loopback admin origin required');
  return u.origin;
}
function label(value) { return typeof value === 'string' ? value.slice(0, 100) : ''; }
function credential(value) {
  const sad = value.sad;
  if (!sad || typeof sad.a !== 'object') throw Error('Unsupported ACDC response');
  return {said:identifier(sad.d),issuer:identifier(sad.i),schema:identifier(sad.s),
    aid:typeof sad.a.i==='string'?identifier(sad.a.i):null,
    lei:label(sad.a.LEI),role:label(sad.a.engagementContextRole || sad.a.officialRole),
    // Registry event is only a local observation, never a current GLEIF trust verdict.
    registryEvent:['iss','bis','rev','brv'].includes(value.status?.et)?value.status.et:'unknown'};
}
export async function snapshot(client, offset=0) {
  if (!Number.isSafeInteger(offset) || offset<0 || offset>100000) throw Error('Invalid page offset');
  const ids=await client.identifiers().list(offset,offset+24);
  const vcs=await client.credentials().list({skip:offset,limit:25});
  if (!Array.isArray(ids.aids)||ids.aids.length>25||!Array.isArray(vcs)||vcs.length>25) throw Error('Invalid page');
  return {format:'bizproof-keria-snapshot-v1',observedAt:new Date().toISOString(),offset,
    identifiers:ids.aids.map(v=>({name:label(v.name),aid:identifier(v.prefix)})),
    credentials:vcs.map(credential),moreIdentifiers:ids.total>offset+ids.aids.length,
    moreCredentialsPossible:vcs.length===25};
}
export async function presentation(client, said) {
  identifier(said);
  const vc=credential(await client.credentials().get(said));
  if(vc.said!==said||!vc.aid||!vc.lei||!vc.role) throw Error('Credential lacks matching vLEI holder/LEI/role');
  if(['rev','brv'].includes(vc.registryEvent)) throw Error('Credential is locally revoked');
  const cesr=await client.credentials().get(said,true);
  if(typeof cesr!=='string'||!cesr.length||Buffer.byteLength(cesr)>250000) throw Error('Invalid CESR export');
  return {format:'bizproof-keria-presentation-v1',observedAt:new Date().toISOString(),
    expected:{aid:vc.aid,said,lei:vc.lei,role:vc.role},cesr};
}
export async function authorizationHeaders(client, name, aid) {
  identifier(aid);
  if(typeof name!=='string'||!name.length||name.length>100) throw Error('Invalid identifier name');
  const hab=await client.identifiers().get(name);
  if(hab.prefix!==aid) throw Error('Selected identifier does not match credential holder');
  // SDK 0.4 signs with the first key only: fail closed for group/multi-key identifiers.
  if(hab.group||hab.state?.k?.length!==1||String(hab.state?.kt)!=='1') throw Error('Only single-key identifiers are supported');
  const request=await client.createSignedRequest(name,'http://127.0.0.1:7676/authorizations/'+aid,{method:'GET'});
  const headers=Object.fromEntries(['signature-input','signature','signify-resource','signify-timestamp'].map(k=>[k,request.headers.get(k)]));
  if(Object.values(headers).some(v=>!v)||headers['signify-resource']!==aid) throw Error('Missing signature headers');
  return headers;
}
export async function operation(client,name) {
  if(typeof name!=='string'||! /^[A-Za-z0-9_.-]{1,200}$/.test(name)) throw Error('Invalid operation name');
  const op=await client.operations().get(name);
  if(op.name!==name||typeof op.done!=='boolean') throw Error('Operation mismatch');
  return {format:'bizproof-keria-operation-v1',observedAt:new Date().toISOString(),name,
    status:op.error?'failed':op.done?'completed':'pending'};
}
