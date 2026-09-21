import {env} from 'cloudflare:workers';
import {getChatGPTUser,getActiveRole} from '@/app/chatgpt-auth';
import {headers} from 'next/headers';
import {serviceAdminAllowed} from './visitor-analytics';
export async function serviceAdmin(){const user=await getChatGPTUser();if(serviceAdminAllowed(user,env.BIZPROOF_SERVICE_ADMIN_IDS))return user;
 if(process.env.NODE_ENV==='development'&&env.BIZPROOF_ANALYTICS_LOCAL_PREVIEW==='true'&&user?.authMode==='demo'&&(await getActiveRole())==='admin'){
  const host=(await headers()).get('host')??'';if(['localhost','127.0.0.1'].includes(host.split(':')[0]))return user;
 }return null;
}
