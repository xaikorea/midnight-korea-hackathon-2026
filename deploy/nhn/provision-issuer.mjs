// Run on the target host, never on a developer machine for production keys.
// Example container mounts: /issuer-data (uid 10002), /secrets (root only), /code (read-only).
import {generateKeyPairSync,randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,existsSync,readFileSync,writeFileSync,chmodSync,chownSync} from 'node:fs';
import {resolve} from 'node:path';
import {initializeIssuer} from '../../services/issuer/core.mjs';
import {ISSUER_ID} from '../../services/issuer/protocol.mjs';
const directory=resolve(process.env.ISSUER_DATA_DIR??'/issuer-data'),secrets=resolve(process.env.ISSUER_SECRETS_DIR??'/secrets');
if(directory===secrets)throw Error('Issuer volume and app configuration must be separate');
mkdirSync(directory,{recursive:true,mode:0o700});mkdirSync(secrets,{recursive:true,mode:0o700});
const serviceFile=resolve(secrets,'issuer-service.env'),clientFile=resolve(secrets,'issuer-client.env');
if(existsSync(serviceFile)!==existsSync(clientFile))throw Error('Incomplete issuer configuration: inspect before provisioning');
const keys=initializeIssuer(directory);
if(!existsSync(serviceFile)){
 const secret=randomBytes(48).toString('hex'),pair=generateKeyPairSync('ed25519');
 const processing={keyId:'platform-'+randomUUID(),publicKey:pair.publicKey.export({format:'jwk'}),privateKey:pair.privateKey.export({format:'jwk'})};
 writeFileSync(serviceFile,'ISSUER_SERVICE_SECRET='+secret+'\n',{mode:0o600,flag:'wx'});
 writeFileSync(clientFile,['BIZPROOF_ISSUER_URL=http://issuer:3201','BIZPROOF_ISSUER_SERVICE_SECRET='+secret,'BIZPROOF_ISSUER_TRUST='+JSON.stringify({issuerId:ISSUER_ID,keyId:keys.keyId,publicKey:keys.publicKey}),'BIZPROOF_PROCESSING_KEY='+JSON.stringify(processing),''].join('\n'),{mode:0o600,flag:'wx'});
}else{
 const client=Object.fromEntries(readFileSync(clientFile,'utf8').trim().split('\n').map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)];}));
 const trust=JSON.parse(client.BIZPROOF_ISSUER_TRUST);
 if(trust.keyId!==keys.keyId||trust.publicKey.x!==keys.publicKey.x||client.BIZPROOF_ISSUER_SERVICE_SECRET!==readFileSync(serviceFile,'utf8').trim().slice('ISSUER_SERVICE_SECRET='.length))throw Error('Provisioned trust does not match issuer key/configuration');
}
chmodSync(serviceFile,0o600);chmodSync(clientFile,0o600);chmodSync(resolve(directory,'issuer-key.json'),0o600);
if(process.platform!=='win32'){chownSync(directory,10002,10002);chownSync(resolve(directory,'issuer-key.json'),10002,10002);}
console.log('Issuer trust and separate platform signing key provisioned. Private values were not displayed.');
