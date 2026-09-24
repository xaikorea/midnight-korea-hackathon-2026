import {DatabaseSync} from 'node:sqlite';
import {generateKeyPairSync, randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {CATALOG, ISSUER_ID, hash, intentBody, credentialBody, signBody} from './protocol.mjs';

export class IssuerError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new IssuerError(status, message); };
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
const now = () => new Date().toISOString();
const parse = row => row ? JSON.parse(row.payload) : fail(404, '이 체험 공간에서 요청을 찾을 수 없습니다.');
function input(value, required, optional=[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>![...required,...optional].includes(k)) || required.some(k=>!(k in value))) fail(400,'입력 항목을 확인하세요.');
}
export function initializeIssuer(directory) {
  const root=resolve(directory); mkdirSync(root,{recursive:true,mode:0o700});
  const file=resolve(root,'issuer-key.json');
  if (!existsSync(file)) {
    // A missing key on a populated installation is a recovery incident, not a new issuer.
    if (existsSync(resolve(root,'issuer.sqlite'))) throw Error('Issuer key missing: restore its backup before startup.');
    const pair=generateKeyPairSync('ed25519');
    writeFileSync(file,JSON.stringify({keyId:'issuer-demo-'+randomUUID(), publicKey:pair.publicKey.export({format:'jwk'}), privateKey:pair.privateKey.export({format:'jwk'})}),{mode:0o600,flag:'wx'});
  }
  return JSON.parse(readFileSync(file,'utf8'));
}
export function openIssuer(directory) {
  const keys=initializeIssuer(directory);
  if (!keys.privateKey?.d || keys.publicKey?.d) throw Error('Invalid issuer key configuration');
  const db=new DatabaseSync(resolve(directory,'issuer.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS identities(id TEXT PRIMARY KEY, scope TEXT NOT NULL, idem TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(scope,idem));
    CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, scope TEXT NOT NULL, idem TEXT NOT NULL, identity_id TEXT UNIQUE NOT NULL, payload TEXT NOT NULL, UNIQUE(scope,idem));
    CREATE TABLE IF NOT EXISTS credentials(id TEXT PRIMARY KEY, scope TEXT NOT NULL, request_id TEXT UNIQUE NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL, request_id TEXT, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS commands(scope TEXT NOT NULL, idem TEXT NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(scope,idem));
    CREATE TABLE IF NOT EXISTS replay(jti TEXT PRIMARY KEY, expires INTEGER NOT NULL);`);
  function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const result=fn(); db.exec('COMMIT'); return result; } catch(e) {db.exec('ROLLBACK');throw e;} }
  function get(table,scope,id) { return parse(db.prepare(`SELECT payload FROM ${table} WHERE scope=? AND id=?`).get(scope,id)); }
  function put(table,record) { db.prepare(`UPDATE ${table} SET payload=? WHERE id=? AND scope=?`).run(JSON.stringify(record),record.id,record.scope); }
  function event(scope,requestId,type,revision,detail) {
    const e={id:randomUUID(),at:now(),type,requestId,revision,detail};
    const row=db.prepare('INSERT INTO events(scope,request_id,payload) VALUES (?,?,?)').run(scope,requestId,JSON.stringify(e));
    return {...e,seq:Number(row.lastInsertRowid)};
  }
  function command(scope,body,fn) {
    if (!uuid(body.key)) fail(400,'요청 식별값을 확인하세요.');
    const digest=hash(body), previous=db.prepare('SELECT * FROM commands WHERE scope=? AND idem=?').get(scope,body.key);
    if (previous) {if(previous.digest!==digest)fail(409,'다른 내용에 사용한 요청 식별값입니다.');return JSON.parse(previous.payload);}
    const result=fn();db.prepare('INSERT INTO commands VALUES (?,?,?,?)').run(scope,body.key,digest,JSON.stringify(result));return result;
  }
  const metadata={issuerId:ISSUER_ID,keyId:keys.keyId,publicKey:keys.publicKey,mode:'synthetic-only',catalog:CATALOG,document:intentBody(),documentHash:hash(intentBody())};
  function requestView(r) {return {...r,events:db.prepare('SELECT seq,payload FROM events WHERE scope=? AND request_id=? ORDER BY seq').all(r.scope,r.id).map(row=>({...JSON.parse(row.payload),seq:row.seq}))};}
  const api={metadata,close:()=>db.close(),
    consumeAuthorization(payload) {
      transaction(()=>{db.prepare('DELETE FROM replay WHERE expires<?').run(Date.now());try{db.prepare('INSERT INTO replay VALUES (?,?)').run(payload.jti,payload.exp);}catch{fail(401,'이미 처리한 서비스 인증입니다.');}});
    },
    handle(method,path,scope,body,query=new URLSearchParams()) {
      if(method==='GET'&&path==='/v1/catalog')return metadata;
      if(method==='GET'&&path==='/v1/issuance-requests')return {requests:db.prepare('SELECT payload FROM requests WHERE scope=? ORDER BY rowid DESC LIMIT 10').all(scope).map(row=>requestView(JSON.parse(row.payload)))};
      if(method==='POST'&&path==='/v1/identity-sessions')return transaction(()=>{
        input(body,['key','mode','documentHash']);if(body.mode!=='simulated')fail(503,'실제 인증기관이 연결되지 않았습니다.');if(body.documentHash!==metadata.documentHash)fail(409,'승인 문서가 변경되었습니다.');
        return command(scope,body,()=>{
          if(db.prepare('SELECT count(*) n FROM identities WHERE scope=?').get(scope).n>=12)fail(429,'이 체험 공간의 인증 체험 한도에 도달했습니다.');
          const r={id:randomUUID(),scope,mode:'simulated',status:'pending',documentHash:body.documentHash,purpose:'synthetic-company-issuance',createdAt:now(),expiresAt:new Date(Date.now()+10*60e3).toISOString()};
          db.prepare('INSERT INTO identities VALUES (?,?,?,?)').run(r.id,scope,body.key,JSON.stringify(r));return r;
        });
      });
      let match=path.match(/^\/v1\/identity-sessions\/([0-9a-f-]+)(?:\/(confirm|cancel))?$/);
      if(match){const r=get('identities',scope,match[1]);if(method==='GET'&&!match[2])return Date.parse(r.expiresAt)<=Date.now()&&r.status!=='consumed'?{...r,status:'expired'}:r;
        if(method==='POST'&&match[2])return transaction(()=>{input(body,['key','documentHash','consent']);return command(scope,{...body,operation:path},()=>{
          const current=get('identities',scope,r.id);
          if(current.status!=='pending'||Date.parse(current.expiresAt)<=Date.now())fail(409,'인증 체험이 만료되었거나 이미 처리되었습니다.');
          if(body.documentHash!==current.documentHash||body.consent!==(match[2]==='confirm'))fail(400,'해당 문서에 대한 동의를 확인하세요.');
          current.status=match[2]==='confirm'?'confirmed':'cancelled';current.confirmedAt=now();put('identities',current);return current;
        });});
      }
      if(method==='POST'&&path==='/v1/issuance-requests')return transaction(()=>{input(body,['key','identityId','documentHash']);return command(scope,body,()=>{
        const identity=get('identities',scope,body.identityId);
        if(identity.mode!=='simulated'||identity.status!=='confirmed'||Date.parse(identity.expiresAt)<=Date.now()||identity.documentHash!==body.documentHash||body.documentHash!==metadata.documentHash)fail(422,'유효한 문서 동의 체험이 필요합니다.');
        const r={id:randomUUID(),scope,companyId:CATALOG.companyId,schemaId:CATALOG.schemaId,identityId:identity.id,identityMode:'simulated',documentHash:body.documentHash,status:'submitted',revision:1,createdAt:now(),updatedAt:now(),reason:''};
        db.prepare('INSERT INTO requests VALUES (?,?,?,?,?)').run(r.id,scope,body.key,identity.id,JSON.stringify(r));identity.status='consumed';put('identities',identity);event(scope,r.id,'submitted',r.revision,'동의 문서 해시·만료·체험 공간을 검사한 후 발급 원장에 접수');return requestView(r);
      });});
      match=path.match(/^\/v1\/issuance-requests\/([0-9a-f-]+)(?:\/(decisions|resubmit|cancel|credential))?$/);
      if(match){const r=get('requests',scope,match[1]);
        if(method==='GET'&&!match[2])return requestView(r);
        if(method==='GET'&&match[2]==='credential'){if(r.status!=='issued')fail(409,'아직 발급되지 않았습니다.');return get('credentials',scope,r.credentialId).credential;}
        if(method==='POST'&&['decisions','resubmit','cancel'].includes(match[2]))return transaction(()=>{
          input(body,['key','revision'],['decision','reason']);if(!Number.isInteger(body.revision))fail(400,'문서 버전을 확인하세요.');
          return command(scope,{...body,operation:path},()=>{
            const current=get('requests',scope,r.id);if(current.revision!==body.revision)fail(409,'검토 중 내용이 변경되었습니다. 새로고침 후 확인하세요.');
            const decision=match[2]==='decisions'?body.decision:match[2];
            if(!['approve','needs_changes','reject','resubmit','cancel'].includes(decision))fail(400,'처리 방법을 확인하세요.');
            if(['issued','rejected','cancelled'].includes(current.status)||decision==='resubmit'&&current.status!=='needs_changes'||decision!=='resubmit'&&decision!=='cancel'&&current.status!=='submitted')fail(409,'현재 상태에서는 처리할 수 없습니다.');
            const reason=typeof body.reason==='string'?body.reason.trim():'';
            if(reason.length>300||['needs_changes','reject','resubmit'].includes(decision)&&reason.length<2)fail(400,'처리 사유를 2~300자로 적어 주세요.');
            current.revision++;current.updatedAt=now();current.reason=reason;
            current.status=({approve:'issued',needs_changes:'needs_changes',reject:'rejected',resubmit:'submitted',cancel:'cancelled'})[decision];
            if(decision==='approve'){
              event(scope,r.id,'review_approved',current.revision,'기관 검토 체험에서 합성 기업 자료와 동의 연결을 승인');
              const credential={id:'remote-'+randomUUID(),proofVersion:3,remoteBinding:{requestId:r.id,scope,identitySessionId:r.identityId,identityMode:'simulated',documentHash:r.documentHash},companyId:CATALOG.companyId,issuerId:ISSUER_ID,schemaId:CATALOG.schemaId,claims:CATALOG.claims,issuedAt:now(),expiresAt:new Date(Date.now()+30*864e5).toISOString(),keyId:keys.keyId,status:'active',source:{kind:'synthetic',reference:r.id,period:'2026 demo',method:'독립 발급 서비스의 합성 자료 검토',reviewer:'scoped-demo-operator',reviewedAt:now(),documents:[],notice:'합성 기업 자료·동의 체험. 실제 기업·본인·대표권 인증이 아닙니다.'},signature:''};
              credential.signature=signBody(keys.privateKey,credentialBody(credential));
              const stored={id:credential.id,scope,requestId:r.id,credential,status:'active',revision:1,updatedAt:now()};
              db.prepare('INSERT INTO credentials VALUES (?,?,?,?)').run(stored.id,scope,r.id,JSON.stringify(stored));current.credentialId=stored.id;
            }
            put('requests',current);event(scope,r.id,current.status,current.revision,decision==='approve'?'발급기관 전용 키로 Ed25519 서명·원본 자격·현재 상태를 같은 SQLite 트랜잭션에 저장':reason||'신청자가 발급 요청을 철회');return requestView(current);
          });
        });
      }
      match=path.match(/^\/v1\/credentials\/(remote-[0-9a-f-]+)\/(status|revocations)$/);
      if(match){const record=get('credentials',scope,match[1]);
        if(method==='GET'&&match[2]==='status'){
          const nonce=query.get('nonce');if(!uuid(nonce))fail(400,'상태 확인 nonce가 필요합니다.');
          const result={context:'bizproof:issuer-status:v1',issuerId:ISSUER_ID,keyId:keys.keyId,scope,credentialId:record.id,credentialDigest:hash(credentialBody(record.credential)),status:record.status,revision:record.revision,nonce,checkedAt:now(),expiresAt:new Date(Date.now()+30e3).toISOString()};
          return {body:result,signature:signBody(keys.privateKey,result)};
        }
        if(method==='POST'&&match[2]==='revocations')return transaction(()=>{input(body,['key','reason']);return command(scope,{...body,operation:path},()=>{
          if(typeof body.reason!=='string'||body.reason.trim().length<2||body.reason.length>300)fail(400,'취소 사유를 2~300자로 적어 주세요.');
          const current=get('credentials',scope,record.id);if(current.status!=='revoked'){current.status='revoked';current.reason=body.reason.trim();current.revision++;current.updatedAt=now();put('credentials',current);event(scope,current.requestId,'revoked',current.revision,current.reason);}return {credentialId:current.id,status:current.status,revision:current.revision};
        });});
      }
      fail(404,'지원하지 않는 발급 API입니다.');
    },
    backup(file) {mkdirSync(dirname(resolve(file)),{recursive:true,mode:0o700});db.prepare('VACUUM INTO ?').run(resolve(file));},
  };
  return api;
}
