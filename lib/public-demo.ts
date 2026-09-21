import {SignJWT,jwtVerify} from 'jose';
export const demoCookie='bizproof-demo';
export const publicDemo=()=>process.env.BIZPROOF_PUBLIC_DEMO==='true';
function key(){const secret=process.env.BIZPROOF_DEMO_SECRET;if(!secret||secret.length<48)throw Error('Public demo secret missing');return new TextEncoder().encode(secret);}
export async function issueDemo(id:string){return new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject(id).setIssuer('bizproof-demo').setAudience('bizproof-demo').setIssuedAt().setExpirationTime('2h').sign(key());}
export async function verifyDemo(token:string){try{const {payload}=await jwtVerify(token,key(),{algorithms:['HS256'],issuer:'bizproof-demo',audience:'bizproof-demo'});return typeof payload.sub==='string'&&/^demo-[a-f0-9-]{36}$/.test(payload.sub)?payload.sub:null;}catch{return null;}}

export function requestOrigin(req:Request){if(publicDemo()){const origin=process.env.BIZPROOF_APP_ORIGIN;if(!origin)throw Error("Public origin missing");return new URL(origin).origin;}return new URL(req.url).origin;}
