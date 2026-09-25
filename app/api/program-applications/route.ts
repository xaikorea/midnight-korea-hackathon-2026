import {createProgramApplication,programFailure} from '@/lib/program-http';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{return await createProgramApplication(req);}catch(e){return programFailure(e);}}
