import {getPrograms,preparePrograms,programFailure} from '@/lib/program-http';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return await getPrograms(req);}catch(e){return programFailure(e);}}
export async function POST(req:Request){try{return await preparePrograms(req);}catch(e){return programFailure(e);}}
