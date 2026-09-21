import {env} from 'cloudflare:workers';
import {serviceAdmin} from '@/lib/service-admin';
import {analyticsDb,analyticsReport,kstParts} from '@/lib/visitor-analytics';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(req:Request){const user=await serviceAdmin();if(!user)return json({error:'서비스 관리자 로그인이 필요합니다.'},403);
 try{const params=new URL(req.url).searchParams,month=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/).parse(params.get('month')??kstParts().month),search=z.string().max(100).parse(params.get('search')??''),page=z.coerce.number().int().min(0).max(100000).parse(params.get('page')??0),kind=z.enum(['visits','customers']).parse(params.get('kind')??'visits');const db=await analyticsDb(env.DB);const report=await analyticsReport(db,month,search,page,kind);
 await db.prepare('INSERT INTO analytics_admin_audit(id,actor,occurred_at,action,month) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,new Date().toISOString(),'analytics.read',month).run();return json(report);
 }catch(e){return json({error:e instanceof z.ZodError?'조회 조건을 확인하세요.':'방문 분석 저장소를 확인할 수 없습니다.'},e instanceof z.ZodError?400:503);}
}
