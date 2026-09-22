import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {serviceAdmin} from '@/lib/service-admin';
import {analyticsDb,analyticsCustomer,kstParts} from '@/lib/visitor-analytics';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function GET(req:Request){const user=await serviceAdmin();if(!user)return Response.json({error:'서비스 관리자 로그인이 필요합니다.'},{status:403,headers});try{
 const params=new URL(req.url).searchParams,identity=z.string().min(1).max(220).parse(params.get('identity')),page=z.coerce.number().int().min(0).max(100000).parse(params.get('page')??0),db=await analyticsDb(env.DB);
 const report=await analyticsCustomer(db,identity,page);await db.prepare('INSERT INTO analytics_admin_audit(id,actor,occurred_at,action,month) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,new Date().toISOString(),'analytics.customer.read',kstParts().month).run();return Response.json(report,{headers});
 }catch(e){return Response.json({error:'고객 이력을 불러오지 못했습니다.'},{status:e instanceof z.ZodError?400:503,headers});}}
