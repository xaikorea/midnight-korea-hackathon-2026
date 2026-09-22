import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {SignJWT,jwtVerify} from 'jose';
export const adminCookie='bizproof-admin';
const key=()=>{const value=process.env.BIZPROOF_ADMIN_SECRET;if(!value||value.length<48)throw Error('Admin secret missing');return new TextEncoder().encode(value);};
export function checkAdminPassword(password:string,hash=process.env.BIZPROOF_ADMIN_PASSWORD_HASH??''){
 const [salt,hex]=hash.split(':');
 if(!salt||!hex||salt.length>128||!/^[a-f0-9]{128}$/i.test(hex)||password.length>200)return false;
 const expected=Buffer.from(hex,'hex'),actual=scryptSync(password,salt,64);
 return timingSafeEqual(actual,expected);
}
export function hashAdminPassword(password:string){
 const salt=randomBytes(32).toString('hex');
 return salt+':'+scryptSync(password,salt,64).toString('hex');
}
export async function issueAdmin(revision=0){return new SignJWT({credentialRevision:revision}).setProtectedHeader({alg:'HS256'}).setIssuer('bizproof-service-admin').setAudience('bizproof-service-admin').setSubject('service-admin').setIssuedAt().setExpirationTime('1h').sign(key());}
export async function verifyAdmin(token:string,revision=0){try{const {payload}=await jwtVerify(token,key(),{algorithms:['HS256'],issuer:'bizproof-service-admin',audience:'bizproof-service-admin'});return payload.sub==='service-admin'&&(payload.credentialRevision??0)===revision;}catch{return false;}}
