import {serviceAdmin} from '@/lib/service-admin';
import {redirect} from 'next/navigation';
import AnalyticsDashboard from './visitor-dashboard';
export const metadata={robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function AdminPage(){const user=await serviceAdmin();if(!user)redirect('/admin/login');return <AnalyticsDashboard administrator={user.displayName} localPreview={user.authMode==='demo'} canChangePassword={user.authMode==='local-admin'}/>;}
