import {z} from 'zod';
export const visitInput=z.object({eventId:z.string().uuid(),path:z.string().min(1).max(180)}).strict();
const allowedViews=new Set(['access','apply','progress','reviews','overview','guide','journey','trust','connections','dashboard','companies','credentials','requests','policies','issuers','schemas','settings','studio','wallet','organization','identity','ssi','suppliers','audit']);
export function safeVisitPath(value:string){const u=new URL(value,'https://analytics.invalid');if(u.origin!=='https://analytics.invalid'||u.pathname!=='/')throw Error('Unsupported page');const view=u.searchParams.get('view');return view&&allowedViews.has(view)?'/?view='+view:'/';}
export function kstParts(now=new Date()){const day=new Date(now.getTime()+9*3600000).toISOString().slice(0,10);return {day,month:day.slice(0,7)};}
export function browserInfo(ua:string){
 const family=/Edg\//.test(ua)?'Edge':/OPR\//.test(ua)?'Opera':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'기타';
 const os=/Windows/.test(ua)?'Windows':/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Macintosh/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'기타';
 return {browser:family,os,device:/bot|crawler|spider/i.test(ua)?'bot':/iPad|Tablet/i.test(ua)?'tablet':/Mobile|iPhone|Android/i.test(ua)?'mobile':'desktop'};
}
export function locationInfo(req:Request,trustedCloudflare:boolean){
 if(!trustedCloudflare)return {ip:null,country:null,region:null,city:null,geoSource:'unavailable'};
 const cf=(req as Request&{cf?:Record<string,unknown>}).cf;
 const clean=(v:unknown,max=100)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x1f]/.test(v)?v:null;
 const candidate=clean(req.headers.get('cf-connecting-ip'),45);
 // Transport addresses only; never use caller-controlled X-Forwarded-For.
 const ipv4=candidate&&/^\d{1,3}(\.\d{1,3}){3}$/.test(candidate)&&candidate.split('.').every(n=>Number(n)<=255);
 const ipv6=candidate&&/^[a-f\d:]+$/i.test(candidate)&&candidate.includes(':')&&candidate.length>=2;
 const country=clean(cf?.country??req.headers.get('cf-ipcountry'),2);
 return {ip:ipv4||ipv6?candidate:null,country:country&&/^[A-Z]{2}$/.test(country)&&!['XX','T1'].includes(country)?country:null,region:clean(cf?.region),city:clean(cf?.city),geoSource:cf?'cloudflare-approximate':'cloudflare-country-only'};
}
export function serviceAdminAllowed(user:{userId:string;authMode:string;allowedRoles:string[]}|null,configuredIds?:string){
 if(!user||user.authMode!=='keycloak')return false;
 try{return z.array(z.string().min(1)).max(50).parse(JSON.parse(configuredIds??'[]')).includes(user.userId)&&user.allowedRoles.includes('admin');}catch{return false;}
}
export const analyticsSchema=[
 `CREATE TABLE IF NOT EXISTS visitor_events (id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, month TEXT NOT NULL, day TEXT NOT NULL, visitor_id TEXT NOT NULL, user_id TEXT, name TEXT, ip TEXT, country TEXT, region TEXT, city TEXT, geo_source TEXT NOT NULL, user_agent TEXT NOT NULL, browser TEXT NOT NULL, os TEXT NOT NULL, device TEXT NOT NULL, path TEXT NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS visitor_events_month_time ON visitor_events(month,occurred_at DESC)`,
 `CREATE INDEX IF NOT EXISTS visitor_events_user ON visitor_events(user_id,occurred_at)`,
 `CREATE INDEX IF NOT EXISTS visitor_events_visitor ON visitor_events(visitor_id,occurred_at)`,
 `CREATE TABLE IF NOT EXISTS analytics_admin_audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, occurred_at TEXT NOT NULL, action TEXT NOT NULL, month TEXT NOT NULL)`
];
const initialized=new WeakMap<D1Database,Promise<unknown>>();
export async function analyticsDb(db:D1Database|undefined){if(!db)throw Error('Analytics database unavailable');let pending=initialized.get(db);if(!pending){pending=db.batch(analyticsSchema.map(sql=>db.prepare(sql))).catch(e=>{initialized.delete(db);throw e;});initialized.set(db,pending);}await pending;return db;}
export type VisitRow={id:string;occurred_at:string;month:string;day:string;visitor_id:string;user_id:string|null;name:string|null;ip:string|null;country:string|null;region:string|null;city:string|null;geo_source:string;user_agent:string;browser:string;os:string;device:string;path:string};
export async function recordVisit(db:D1Database,row:VisitRow){const keys=Object.keys(row) as (keyof VisitRow)[];await db.prepare(`INSERT OR IGNORE INTO visitor_events (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).bind(...keys.map(k=>row[k])).run();}
export async function analyticsReport(db:D1Database,month:string,search:string,page:number,kind:'visits'|'customers'){
 const escaped='%'+search.replace(/[\\%_]/g,v=>'\\'+v)+'%';const where="month=? AND (?='' OR COALESCE(name,'') LIKE ? ESCAPE '\\' OR COALESCE(ip,'') LIKE ? ESCAPE '\\' OR path LIKE ? ESCAPE '\\')";
 const args=[month,search,escaped,escaped,escaped];
 const queries=[
 db.prepare('SELECT COUNT(*) visits, COUNT(DISTINCT visitor_id) visitors, COUNT(DISTINCT user_id) customers, COUNT(DISTINCT country) countries FROM visitor_events WHERE month=?').bind(month),
 db.prepare('SELECT day label, COUNT(*) value FROM visitor_events WHERE month=? GROUP BY day ORDER BY day').bind(month),
 db.prepare("SELECT COALESCE(country,'미확인') label, COUNT(*) value FROM visitor_events WHERE month=? GROUP BY country ORDER BY value DESC LIMIT 12").bind(month),
 db.prepare('SELECT browser label, COUNT(*) value FROM visitor_events WHERE month=? GROUP BY browser ORDER BY value DESC').bind(month),
 db.prepare('SELECT month label, COUNT(*) value FROM visitor_events GROUP BY month ORDER BY month DESC LIMIT 24'),
 db.prepare(kind==='visits'?`SELECT COUNT(*) total FROM visitor_events WHERE ${where}`:`SELECT COUNT(*) total FROM (SELECT COALESCE(user_id,'anonymous:'||visitor_id) FROM visitor_events WHERE ${where} GROUP BY COALESCE(user_id,'anonymous:'||visitor_id))`).bind(...args),
 db.prepare(kind==='visits'?`SELECT * FROM visitor_events WHERE ${where} ORDER BY occurred_at DESC,id DESC LIMIT 50 OFFSET ?`:`SELECT COALESCE(user_id,'anonymous:'||visitor_id) identity, MAX(name) name, MAX(user_id) user_id, COUNT(*) visits, COUNT(DISTINCT ip) ip_count, MIN(occurred_at) first_seen, MAX(occurred_at) last_seen FROM visitor_events WHERE ${where} GROUP BY COALESCE(user_id,'anonymous:'||visitor_id) ORDER BY last_seen DESC,identity LIMIT 50 OFFSET ?`).bind(...args,page*50)
 ];
 const results=await db.batch<Record<string,unknown>>(queries);
 return {month,summary:results[0].results[0],daily:results[1].results,countries:results[2].results,browsers:results[3].results,months:results[4].results,total:Number(results[5].results[0]?.total??0),rows:results[6].results,page,kind,refreshedAt:new Date().toISOString(),retention:'자동 삭제 없음 · 과거 월 원본 유지',timezone:'Asia/Seoul'};
}
