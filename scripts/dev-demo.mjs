import {randomBytes,scryptSync} from 'node:crypto';
import {mkdirSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
const port=Number(process.env.PORT??3100);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be between 1024 and 65535');
const directory=resolve(process.env.BIZPROOF_DEMO_DIR??'outputs/local-web-demo');mkdirSync(directory,{recursive:true,mode:0o700});
const file=resolve(directory,'local-secrets.json');
if(!existsSync(file)){const salt=randomBytes(24).toString('hex');writeFileSync(file,JSON.stringify({BIZPROOF_DEMO_SECRET:randomBytes(48).toString('hex'),BIZPROOF_ADMIN_SECRET:randomBytes(48).toString('hex'),BIZPROOF_ADMIN_PASSWORD_HASH:salt+':'+scryptSync(randomBytes(48).toString('hex'),salt,64).toString('hex')}),{mode:0o600,flag:'wx'});}
const env={...process.env,...JSON.parse(readFileSync(file,'utf8')),BIZPROOF_PUBLIC_DEMO:'true',BIZPROOF_AUTH_MODE:'demo',BIZPROOF_APP_ORIGIN:'http://127.0.0.1:'+port,BIZPROOF_DATA_DIR:resolve(directory,'data'),NEXT_TELEMETRY_DISABLED:'1'};
console.log('Synthetic local demo: '+env.BIZPROOF_APP_ORIGIN+' (private state stays in the configured local demo directory)');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{stdio:'inherit',env});
child.on('exit',code=>process.exit(code??1));child.on('error',error=>{console.error(error.message);process.exitCode=1;});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
