import {cookies} from 'next/headers';
import {publicDemo} from './public-demo';
import {adminCookie,verifyAdmin} from './demo-admin';
import {env} from 'cloudflare:workers';
import {getChatGPTUser,getActiveRole} from '@/app/chatgpt-auth';
import {headers} from 'next/headers';
import {serviceAdminAllowed} from './visitor-analytics';
export async function serviceAdmin(){if(publicDemo()&&await verifyAdmin((await cookies()).get(adminCookie)?.value??''))return {userId:'service-admin',displayName:'서비스 관리자',authMode:'local-admin'};const user=await getChatGPTUser();if(serviceAdminAllowed(user,env.BIZPROOF_SERVICE_ADMIN_IDS))return user;
 if(process.env.NODE_ENV==='development'&&env.BIZPROOF_ANALYTICS_LOCAL_PREVIEW==='true'&&user?.authMode==='demo'&&(await getActiveRole())==='admin'){
  const host=(await headers()).get('host')??'';if(['localhost','127.0.0.1'].includes(host.split(':')[0]))return user;
 }return null;
}
