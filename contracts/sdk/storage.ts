import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
import {Level} from 'level';
import {levelPrivateStateProvider} from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import type {Network} from './config.ts';
export type StorageOptions={network:Network;accountId:string;role:string;storageDirectory:string;passwordProvider:()=>string|Promise<string>};
export function privateStorage<PS>(options:StorageOptions){
 if(!options.accountId.trim())throw Error('비공개 저장소 계정이 필요합니다.');
 const scope=JSON.stringify([options.network,options.accountId,options.role]);
 const directory=resolve(options.storageDirectory,createHash('sha256').update(scope).digest('hex'));mkdirSync(directory,{recursive:true,mode:0o700});
 const databases:Level<string,string>[]=[];
 const provider=levelPrivateStateProvider<string,PS>({midnightDbName:resolve(directory,'state'),privateStateStoreName:'bizproof-private-state',signingKeyStoreName:'bizproof-maintenance-keys',accountId:scope,privateStoragePasswordProvider:options.passwordProvider,levelFactory:name=>{const database=new Level<string,string>(name,{valueEncoding:'utf8'});databases.push(database);return database;}});
 return {provider,close:async()=>{await provider.invalidateEncryptionCache();await Promise.all(databases.map(db=>db.close()));}};
}
