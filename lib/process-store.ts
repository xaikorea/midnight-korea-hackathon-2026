import {binding} from './store';
import {encodeStorage,decodeStorage} from './storage-protection';
import type {BusinessActor} from './business-access';
import {requireBusinessAccess} from './business-access';
import type {ProcessRun} from './process-types';

async function tables(){
  const db=binding();
  await db.prepare('CREATE TABLE IF NOT EXISTS application_process_runs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,actor TEXT NOT NULL,company_id TEXT NOT NULL,created_at TEXT NOT NULL,payload TEXT NOT NULL)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS application_process_owner ON application_process_runs(owner,created_at DESC)').run();
  return db;
}
export async function createProcessRun(ctx:BusinessActor,run:ProcessRun){
  const db=await tables();
  await db.prepare('INSERT INTO application_process_runs(id,owner,actor,company_id,created_at,payload) VALUES (?,?,?,?,?,?)').bind(run.id,ctx.owner,ctx.actor,run.companyId,run.startedAt,await encodeStorage(ctx.owner,JSON.stringify(run))).run();
}
export async function saveProcessRun(ctx:BusinessActor,run:ProcessRun){
  const result=await binding().prepare('UPDATE application_process_runs SET payload=? WHERE id=? AND owner=? AND actor=?').bind(await encodeStorage(ctx.owner,JSON.stringify(run)),run.id,ctx.owner,ctx.actor).run();
  if(result.meta.changes!==1)throw Error('Process history was not saved');
}
export async function listProcessRuns(ctx:BusinessActor,id?:string){
  if(!['company','admin'].includes(ctx.role))return [];
  const db=await tables();
  const rows=await db.prepare('SELECT company_id,payload FROM application_process_runs WHERE owner=? AND (?=1 OR actor=?) AND (? IS NULL OR id=?) ORDER BY created_at DESC LIMIT 20')
    .bind(ctx.owner,ctx.role==='admin'?1:0,ctx.actor,id??null,id??null).all<{company_id:string;payload:string}>();
  const runs:ProcessRun[]=[];
  for(const row of rows.results??[]){
    try{await requireBusinessAccess(ctx,row.company_id);}catch(e){if((e as {status?:number}).status===403)continue;throw e;}
    runs.push(JSON.parse(await decodeStorage(ctx.owner,row.payload)) as ProcessRun);
  }
  return runs;
}
