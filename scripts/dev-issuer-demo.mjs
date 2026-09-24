import {generateKeyPairSync,randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {initializeIssuer} from '../services/issuer/core.mjs';
import {ISSUER_ID} from '../services/issuer/protocol.mjs';

const root=resolve(process.env.BIZPROOF_ISSUANCE_DEMO_DIR??'outputs/independent-issuance-demo');
mkdirSync(root,{recursive:true,mode:0o700});
const file=resolve(root,'local-config.json');
if(!existsSync(file)){
 const pair=generateKeyPairSync('ed25519');
 writeFileSync(file,JSON.stringify({secret:randomBytes(48).toString('hex'),processing:{keyId:'platform-'+randomUUID(),privateKey:pair.privateKey.export({format:'jwk'}),publicKey:pair.publicKey.export({format:'jwk'})}}),{mode:0o600,flag:'wx'});
}
const config=JSON.parse(readFileSync(file,'utf8')),issuerRoot=resolve(root,'issuer-only'),issuer=initializeIssuer(issuerRoot);
const issuerPort=process.env.ISSUER_PORT??'3201',port=process.env.PORT??'3120';
const children=[];
children.push(spawn(process.execPath,['services/issuer/server.mjs'],{stdio:'inherit',env:{...process.env,ISSUER_SERVICE_SECRET:config.secret,ISSUER_DATA_DIR:issuerRoot,ISSUER_PORT:issuerPort}}));
const issuerUrl='http://127.0.0.1:'+issuerPort;
try{
 for(let attempt=0;;attempt++){try{const r=await fetch(issuerUrl+'/health');if(r.ok)break;}catch{}if(attempt>40)throw Error('Issuer startup timed out');await new Promise(r=>setTimeout(r,100));}
 children.push(spawn(process.execPath,['scripts/dev-demo.mjs'],{stdio:'inherit',env:{...process.env,PORT:port,BIZPROOF_NEXT_DIST:'.next-issuer-dev',BIZPROOF_DEMO_DIR:resolve(root,'web-only'),BIZPROOF_ISSUER_URL:issuerUrl,BIZPROOF_ISSUER_SERVICE_SECRET:config.secret,BIZPROOF_ISSUER_TRUST:JSON.stringify({issuerId:ISSUER_ID,keyId:issuer.keyId,publicKey:issuer.publicKey}),BIZPROOF_PROCESSING_KEY:JSON.stringify(config.processing)}}));
 console.log('Issuance experience: http://127.0.0.1:'+port+'/issuance');
}catch(error){for(const child of children)child.kill();throw error;}
let closing=false;
function close(){if(closing)return;closing=true;for(const child of children)child.kill();}
for(const child of children){child.on('exit',()=>close());child.on('error',()=>close());}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,close);
