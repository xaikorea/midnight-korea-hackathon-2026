import Platform from './platform';
import Welcome from './welcome-screen';
import {publicDemo} from '@/lib/public-demo';
export default async function Home({searchParams}:{searchParams:Promise<{view?:string}>}){const params=await searchParams;return publicDemo()&&!params.view?<Welcome/>:<Platform/>}
