import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {env} from 'cloudflare:workers';
import {publicDemo} from '@/lib/public-demo';
import {adminCookie,issueAdmin,verifyAdmin} from '@/lib/demo-admin';
import {adminCredential,passwordChangeError,replaceAdminPassword} from '@/lib/admin-credentials';

const reply=(error:string,status:number)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});

export async function POST(req:Request){
 const origin=process.env.BIZPROOF_APP_ORIGIN;
 if(!publicDemo()||!origin||req.headers.get('origin')!==origin)return reply('허용되지 않은 요청입니다.',403);
 const token=(await cookies()).get(adminCookie)?.value??'';
 if(!token)return reply('관리자 로그인이 필요합니다.',401);
 try{
  const db=env.DB!,credential=await adminCredential(db);
  if(!await verifyAdmin(token,credential.revision))return reply('세션이 만료되었습니다. 다시 로그인하세요.',401);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return reply('입력 형식을 확인하세요.',415);
  const raw=await req.text();
  if(raw.length>4000)return reply('입력 내용이 너무 깁니다.',413);
  let input:unknown;
  try{input=JSON.parse(raw);}catch{return reply('입력 형식을 확인하세요.',400);}
  const error=passwordChangeError(input);
  if(error)return reply(error,400);
  // Account-wide bound: spoofing an IP cannot bypass current-password guessing limits.
  await db.prepare('CREATE TABLE IF NOT EXISTS admin_password_rate(username TEXT PRIMARY KEY,window INTEGER NOT NULL,n INTEGER NOT NULL)').run();
  const window=Math.floor(Date.now()/900000);
  const attempt=await db.prepare("INSERT INTO admin_password_rate VALUES('admin',?,1) ON CONFLICT(username) DO UPDATE SET window=excluded.window,n=CASE WHEN admin_password_rate.window=excluded.window THEN admin_password_rate.n+1 ELSE 1 END WHERE admin_password_rate.window<>excluded.window OR admin_password_rate.n<6").bind(window).run();
  if(attempt.meta.changes!==1){const res=reply('시도 횟수가 많습니다. 15분 후 다시 시도하세요.',429);res.headers.set('Retry-After','900');return res;}
  const {currentPassword,newPassword}=input as {currentPassword:string;newPassword:string};
  // Sign before the commit: a signing configuration error must not leave a changed credential.
  const nextToken=await issueAdmin(credential.revision+1);
  if(!await replaceAdminPassword(db,credential,currentPassword,newPassword))return reply('현재 비밀번호가 맞지 않거나 이미 변경되었습니다. 다시 확인하세요.',400);
  const res=NextResponse.json({ok:true,message:'비밀번호를 변경했습니다. 다른 기기의 관리자 세션은 만료되었습니다.'},{headers:{'Cache-Control':'no-store'}});
  res.cookies.set(adminCookie,nextToken,{httpOnly:true,sameSite:'strict',secure:origin.startsWith('https:'),path:'/',maxAge:3600});
  return res;
 }catch{return reply('비밀번호 변경을 완료하지 못했습니다. 잠시 후 다시 시도하세요.',503);}
}
