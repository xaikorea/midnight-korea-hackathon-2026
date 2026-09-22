import {checkAdminPassword,hashAdminPassword,verifyAdmin} from './demo-admin';

export type AdminCredential={username:string;password_hash:string;revision:number;changed_at:string|null};

// The environment hash is used only to initialize an empty installation. After
// initialization, SQLite/D1 is authoritative; a restart cannot restore the old password.
export async function adminCredential(db:D1Database):Promise<AdminCredential>{
 await db.prepare(`CREATE TABLE IF NOT EXISTS admin_credentials (
  username TEXT PRIMARY KEY CHECK(username='admin'),password_hash TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,changed_at TEXT
 )`).run();
 let row=await db.prepare("SELECT * FROM admin_credentials WHERE username='admin'").first<AdminCredential>();
 if(!row){
  const hash=process.env.BIZPROOF_ADMIN_PASSWORD_HASH??'';
  if(!/^[^:]{1,128}:[a-f0-9]{128}$/i.test(hash))throw Error('Admin credential unavailable');
  await db.prepare("INSERT INTO admin_credentials(username,password_hash,revision) VALUES('admin',?,0) ON CONFLICT(username) DO NOTHING").bind(hash).run();
  row=await db.prepare("SELECT * FROM admin_credentials WHERE username='admin'").first<AdminCredential>();
 }
 if(!row)throw Error('Admin credential unavailable');
 return row;
}

export async function verifyStoredAdmin(db:D1Database,token:string){
 if(!token)return false;
 return verifyAdmin(token,(await adminCredential(db)).revision);
}

export function passwordChangeError(value:unknown):string|null{
 if(!value||typeof value!=='object')return '비밀번호 입력을 확인하세요.';
 const {currentPassword,newPassword,confirmPassword}=value as Record<string,unknown>;
 if(typeof currentPassword!=='string'||!currentPassword||currentPassword.length>200)return '현재 비밀번호를 입력하세요.';
 if(typeof newPassword!=='string'||Array.from(newPassword).length<8||newPassword.length>200)return '새 비밀번호는 8자 이상, 200자 이하로 입력하세요.';
 if(newPassword!==confirmPassword)return '새 비밀번호와 확인 입력이 일치하지 않습니다.';
 if(currentPassword===newPassword)return '현재 비밀번호와 다른 새 비밀번호를 입력하세요.';
 return null;
}

export async function replaceAdminPassword(db:D1Database,previous:AdminCredential,currentPassword:string,newPassword:string){
 // Revalidate here so no caller can bypass the password policy.
 if(passwordChangeError({currentPassword,newPassword,confirmPassword:newPassword}))return false;
 if(!checkAdminPassword(currentPassword,previous.password_hash))return false;
 const hash=hashAdminPassword(newPassword),revision=previous.revision+1,at=new Date().toISOString();
 await db.prepare(`CREATE TABLE IF NOT EXISTS admin_security_audit (
  revision INTEGER PRIMARY KEY,occurred_at TEXT NOT NULL,action TEXT NOT NULL
 )`).run();
 const result=await db.batch([
  db.prepare("UPDATE admin_credentials SET password_hash=?,revision=?,changed_at=? WHERE username='admin' AND revision=? AND password_hash=?")
   .bind(hash,revision,at,previous.revision,previous.password_hash),
  db.prepare("INSERT INTO admin_security_audit(revision,occurred_at,action) SELECT revision,changed_at,'password_changed' FROM admin_credentials WHERE username='admin' AND revision=? AND password_hash=?")
   .bind(revision,hash),
 ]);
 return result[0].meta.changes===1;
}
