import {uploadProgramDocument,programFailure} from '@/lib/program-http';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{return await uploadProgramDocument(req);}catch(e){return programFailure(e);}}
