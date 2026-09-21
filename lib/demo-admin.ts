import {scryptSync,timingSafeEqual} from 'node:crypto';
import {SignJWT,jwtVerify} from 'jose';
export const adminCookie='bizproof-admin';
const key=()=>{const value=process.env.BIZPROOF_ADMIN_SECRET;if(!value||value.length<48)throw Error('Admin secret missing');return new TextEncoder().encode(value);};
export function checkAdminPassword(password:string){const [salt,hex]=String(process.env.BIZPROOF_ADMIN_PASSWORD_HASH??'').split(':');if(!salt||!hex||password.length>200)return false;const expected=Buffer.from(hex,'hex');const actual=scryptSync(password,salt,64);return expected.length===actual.length&&timingSafeEqual(actual,expected);}
export async function issueAdmin(){return new SignJWT({}).setProtectedHeader({alg:'HS256'}).setIssuer('bizproof-service-admin').setAudience('bizproof-service-admin').setSubject('service-admin').setIssuedAt().setExpirationTime('1h').sign(key());}
export async function verifyAdmin(token:string){try{const {payload}=await jwtVerify(token,key(),{algorithms:['HS256'],issuer:'bizproof-service-admin',audience:'bizproof-service-admin'});return payload.sub==='service-admin';}catch{return false;}}
