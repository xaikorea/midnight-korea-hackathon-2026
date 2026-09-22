import {NextResponse} from 'next/server';
import {adminCookie} from '@/lib/demo-admin';
import {publicDemo,requestOrigin} from '@/lib/public-demo';
import {POST as identityLogout} from '@/app/api/auth/[action]/route';
export async function POST(req:Request){
 const origin=requestOrigin(req);if(req.headers.get('origin')!==origin)return new Response(null,{status:403});
 if(!publicDemo())return identityLogout(req);
 const res=NextResponse.redirect(new URL('/admin/login',origin),303);
 res.cookies.set(adminCookie,'',{path:'/',maxAge:0,httpOnly:true,sameSite:'strict',secure:origin.startsWith('https:')});res.headers.set('Cache-Control','no-store');return res;
}
