import {precheckPrograms,programFailure} from '@/lib/program-http';
export const dynamic='force-dynamic';
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){try{return await precheckPrograms(req,(await ctx.params).id);}catch(e){return programFailure(e);}}
