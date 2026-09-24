// Run on the web host after the independent issuer is provisioned. No secret stdout.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
const root=resolve(process.argv[2]??'outputs/proof-worker-config');mkdirSync(root,{recursive:true,mode:0o700});
const processing=JSON.parse(process.env.BIZPROOF_PROCESSING_KEY??'null'),issuer=JSON.parse(process.env.BIZPROOF_ISSUER_TRUST??'null'),origin=process.env.BIZPROOF_APP_ORIGIN;
if(!processing?.publicKey||processing.publicKey.d||!issuer?.publicKey||issuer.publicKey.d||!origin)throw Error('Load the existing issuer trust, processing key and fixed app origin on the host first.');
const envFile=resolve(root,'proof-jobs.env'),executorFile=resolve(root,'executor.json'),verifierFile=resolve(root,'verifier.json');
if([envFile,executorFile,verifierFile].some(existsSync)){
 if(![envFile,executorFile,verifierFile].every(existsSync))throw Error('Incomplete worker config. Restore the matching files, do not silently rotate.');
 const executor=JSON.parse(readFileSync(executorFile,'utf8'));
 if(executor.origin!==origin||JSON.stringify(executor.pins.issuer)!==JSON.stringify(issuer)||executor.pins.platform.keyId!==processing.keyId)throw Error('Existing worker trust differs. Explicit rotation required.');
 console.log('Existing worker configuration retained.');
}else{
 const executorSecret=randomBytes(48).toString('hex'),verifierSecret=randomBytes(48).toString('hex'),pair=generateKeyPairSync('ed25519');
 writeFileSync(executorFile,JSON.stringify({origin,secret:executorSecret,pins:{platform:{keyId:processing.keyId,publicKey:processing.publicKey},issuer}}),{mode:0o600,flag:'wx'});
 writeFileSync(verifierFile,JSON.stringify({origin,secret:verifierSecret,key:pair.privateKey.export({format:'jwk'})}),{mode:0o600,flag:'wx'});
 writeFileSync(envFile,'BIZPROOF_PROOF_WORKER_SECRET='+executorSecret+'\nBIZPROOF_PROOF_VERIFIER_SECRET='+verifierSecret+'\nBIZPROOF_PROOF_VERIFIER_TRUST='+JSON.stringify(pair.publicKey.export({format:'jwk'}))+'\n',{mode:0o600,flag:'wx'});
 console.log('Created separate executor and read-only verifier configurations. Keep both outside Git and web volumes.');
}
