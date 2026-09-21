import {fileURLToPath} from 'node:url';
import {setNetworkId} from '@midnight-ntwrk/midnight-js-network-id';
export type Network='undeployed'|'preprod';
export const assetsDirectory=fileURLToPath(new URL('../managed/',import.meta.url));
export const circuits=['registerIssuer','suspendIssuer','resumeIssuer','revokeCredential','advanceTime','rotateAdministrator','createRequest','cancelRequest','submit'] as const;
export type Circuit=typeof circuits[number];
export type IndexerConfiguration={indexer:string;indexerWs:string};
// Used only by local SDK callers, never accepted as URLs by the web server's bridge routes.
export function walletIndexer(config:{networkId:string;indexerUri:string;indexerWsUri:string},network:Network):IndexerConfiguration{
 if(config.networkId!==network)throw Error('지갑 서비스 네트워크가 다릅니다.');
 const endpoint=(value:string,websocket:boolean)=>{const url=new URL(value);const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);if(url.username||url.password||url.hash||!(url.protocol===(websocket?'wss:':'https:')||(network==='undeployed'&&local&&url.protocol===(websocket?'ws:':'http:'))))throw Error('지갑 인덱서 서비스 주소 형식을 확인하세요.');return url.href;};
 return {indexer:endpoint(config.indexerUri,false),indexerWs:endpoint(config.indexerWsUri,true)};
}
export function configuration(network:Network){
 if(network!=='undeployed'&&network!=='preprod')throw Error('지원하는 네트워크는 undeployed 또는 preprod입니다.');
 return {network,indexer:network==='undeployed'?'http://127.0.0.1:8088/api/v4/graphql':'https://indexer.preprod.midnight.network/api/v4/graphql',indexerWs:network==='undeployed'?'ws://127.0.0.1:8088/api/v4/graphql/ws':'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',proofServer:'http://127.0.0.1:6300'};
}
let activeNetwork:Network|undefined;
export function activateNetwork(network:Network){configuration(network);if(activeNetwork&&activeNetwork!==network)throw Error('한 SDK 프로세스에서는 네트워크를 변경할 수 없습니다. 별도 프로세스로 실행하세요.');setNetworkId(network);activeNetwork=network;}
export function bytes32(hex:string){if(!/^[a-f\d]{64}$/i.test(hex))throw Error('32바이트 식별값은 64자리 16진수여야 합니다.');return Uint8Array.from(Buffer.from(hex,'hex'));}
export function address(value:string){if(!/^[a-f\d]{64}$/i.test(value))throw Error('컨트랙트 주소 형식을 확인하세요.');return value.toLowerCase();}
