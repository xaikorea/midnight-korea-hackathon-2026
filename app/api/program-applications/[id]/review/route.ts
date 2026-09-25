import {reviewPrograms,programFailure} from '@/lib/program-http';
export const dynamic='force-dynamic';
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){try{return await reviewPrograms(req,(await ctx.params).id);}catch(e){return programFailure(e);}}
