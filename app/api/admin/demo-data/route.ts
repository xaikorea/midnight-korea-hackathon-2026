import {NextResponse} from 'next/server';
import {serviceAdmin} from '@/lib/service-admin';
import {publicDemo,requestOrigin} from '@/lib/public-demo';
import {prepareDemoPool,demoPoolStatus,prepareActiveDemoWorkspaces} from '@/lib/demo-pool';
export const dynamic='force-dynamic';
export async function GET(){if(!publicDemo()||!await serviceAdmin())return NextResponse.json({error:'관리자 인증이 필요합니다.'},{status:403});return NextResponse.json(await demoPoolStatus(),{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){if(!publicDemo()||!await serviceAdmin())return NextResponse.json({error:'관리자 인증이 필요합니다.'},{status:403});if(req.headers.get('origin')!==requestOrigin(req))return NextResponse.json({error:'요청 출처를 확인하세요.'},{status:403});const pool=await prepareDemoPool(5);const activePrepared=await prepareActiveDemoWorkspaces();return NextResponse.json({...pool,activePrepared},{headers:{'Cache-Control':'no-store'}});}
