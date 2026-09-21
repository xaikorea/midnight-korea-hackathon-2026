import {artifactManifest,inspectContract,publicProvider} from './public-state.ts';
import {prepareDeployment} from './prepare.ts';
import {configuration,type Network} from './config.ts';
const network=(process.env.BIZPROOF_MIDNIGHT_NETWORK??'undeployed') as Network;
configuration(network);
let manifest:ReturnType<typeof artifactManifest>|undefined;
let preparing=false;
let provider:ReturnType<typeof publicProvider>|undefined;
export async function sdkRequest(method:string|undefined,path:string){const url=new URL(path,'http://127.0.0.1:4011');
 if(method==='GET'&&url.pathname==='/sdk/manifest'){manifest??=artifactManifest().catch(e=>{manifest=undefined;throw e;});return {network,...await manifest};}
 if(method==='POST'&&url.pathname==='/sdk/prepare'){if(network!=='undeployed')throw Error('오프라인 준비는 undeployed 브리지에서 실행하세요.');if(preparing)throw Error('SDK 준비 작업이 진행 중입니다.');preparing=true;try{return await prepareDeployment();}finally{preparing=false;}}
 if(method==='GET'&&url.pathname==='/sdk/contract'){provider??=publicProvider(network);return inspectContract(provider,network,url.searchParams.get('address')??'',url.searchParams.get('request')??undefined);}
 throw Error('지원하지 않는 SDK 작업입니다.');
}
