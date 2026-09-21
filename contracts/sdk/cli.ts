import {artifactManifest,inspectContract,publicProvider} from './public-state.ts';
import {prepareDeployment} from './prepare.ts';
import {configuration,type Network} from './config.ts';
const [command,networkName,contractAddress,requestId]=process.argv.slice(2);
try{const network=(networkName??'undeployed') as Network;configuration(network);let result:unknown;if(command==='manifest')result={network,...await artifactManifest()};else if(command==='prepare'){if(network!=='undeployed')throw Error('준비 검사는 undeployed 네트워크를 사용하세요.');result=await prepareDeployment();}else if(command==='inspect'&&contractAddress)result=await inspectContract(publicProvider(network),network,contractAddress,requestId);else throw Error('사용법: node contracts/sdk/cli.ts manifest | prepare | inspect <undeployed|preprod> <contract hex> [request hex]');console.log(JSON.stringify(result,null,2));}catch(e){console.error(e instanceof Error?e.message:'SDK 작업 실패');process.exitCode=1;}
