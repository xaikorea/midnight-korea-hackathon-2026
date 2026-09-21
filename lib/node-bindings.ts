// NHN Node runtime. Cloudflare builds continue using their native bindings.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.env.BIZPROOF_DATA_DIR??'.node-data');
let database:DatabaseSync|undefined;
function db(){if(!database){mkdirSync(root,{recursive:true,mode:0o700});database=new DatabaseSync(path.join(root,'bizproof.sqlite'));database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS workspaces(owner TEXT PRIMARY KEY,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0);');}return database;}
class Statement{
 constructor(readonly sql:string,readonly args:(string|number|null)[]=[]){ }
 bind(...args:(string|number|null)[]){return new Statement(this.sql,args);}
 execute(){const s=db().prepare(this.sql);if(s.columns().length)return {success:true,results:s.all(...this.args),meta:{changes:0}};const r=s.run(...this.args);return {success:true,results:[],meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
 async first(column?:string){const row=db().prepare(this.sql).get(...this.args);return row?(column?row[column]:row):null;}
 async all(){return this.execute();}
 async run(){return this.execute();}
 async raw(){const s=db().prepare(this.sql);s.setReturnArrays(true);return s.all(...this.args);}
}
const DB={prepare:(sql:string)=>new Statement(sql),async batch(statements:Statement[]){db().exec('BEGIN IMMEDIATE');try{const rows=statements.map(s=>s.execute());db().exec('COMMIT');return rows;}catch(e){db().exec('ROLLBACK');throw e;}},async exec(sql:string){db().exec(sql);return {count:1,duration:0};}};
function filename(key:string){if(!/^evidence\/[a-zA-Z0-9:_-]+\/[a-f0-9-]{36}$/.test(key))throw Error('Invalid object key');const dir=path.join(root,'evidence');mkdirSync(dir,{recursive:true,mode:0o700});return path.join(dir,Buffer.from(key).toString('hex')+'.json');}
const BUCKET={async put(key:string,body:ArrayBuffer|string|Uint8Array,options:Record<string,unknown>={}){const file=filename(key),tmp=file+'.'+crypto.randomUUID()+'.tmp';const bytes=typeof body==='string'?Buffer.from(body):Buffer.from(body as Uint8Array);writeFileSync(tmp,JSON.stringify({body:bytes.toString('base64'),...options}),{mode:0o600});renameSync(tmp,file);},async get(key:string){const file=filename(key);if(!existsSync(file))return null;const value=JSON.parse(readFileSync(file,'utf8'));const bytes=Buffer.from(value.body,'base64');return {...value,arrayBuffer:async()=>Uint8Array.from(bytes).buffer,text:async()=>bytes.toString('utf8')};},async delete(key:string){const file=filename(key);if(existsSync(file))unlinkSync(file);}};
export const env=new Proxy({} as Cloudflare.Env,{get(_target,key){if(key==='DB')return DB;if(key==='BUCKET')return BUCKET;return process.env[String(key)];}});
