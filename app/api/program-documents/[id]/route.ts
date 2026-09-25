import {downloadProgramDocument,programFailure} from '@/lib/program-http';
export const dynamic='force-dynamic';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){try{return await downloadProgramDocument(req,(await ctx.params).id);}catch(e){return programFailure(e);}}
