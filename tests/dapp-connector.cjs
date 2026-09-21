const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {WalletSession,discoverWallets,duplicateWallets,walletError}=require('../lib/midnight-wallet.ts');
(async()=>{
 let address='first-account',denied=false,reads=0;const hints=[];
 const api={hintUsage:async methods=>{hints.push(methods);if(denied&&methods.includes('getDustBalance'))throw {type:'DAppConnectorAPIError',code:'PermissionRejected',reason:'private-token'};},getConnectionStatus:async()=>({status:'connected',networkId:'preprod'}),getConfiguration:async()=>({networkId:'preprod',indexerUri:'https://indexer.example',substrateNodeUri:'wss://node.example'}),getShieldedAddresses:async()=>({shieldedAddress:address}),getDustBalance:async()=>{reads++;return {balance:9007199254740993n,cap:99999999999999999n};},getTxHistory:async(page,size)=>{assert.equal(page,1);assert.equal(size,5);return [{txHash:'ab'.repeat(32),txStatus:{status:'finalized',executionStatus:{0:'Success',1:'Failure'}}},{txHash:'cd'.repeat(32),txStatus:{status:'pending'}}];}};
 const initial={name:'Example',rdns:'org.example.wallet',apiVersion:'4.0.1',connect:async()=>api};
 for(const version of ['3.0.0','5.0.0','4.bad','4.0.0-beta','4.01.0'])assert.equal(discoverWallets({wallet:{...initial,apiVersion:version}}).length,0);
 const choices=discoverWallets({a:initial,b:initial});assert.equal(duplicateWallets(choices),true);
 const session=new WalletSession();await session.connect(choices[0],'preprod');assert.equal(reads,0);assert.deepEqual(hints[0],['getConnectionStatus','getConfiguration','getShieldedAddresses']);assert.equal((await session.dust()).balance,'9007199254740993');
 denied=true;await assert.rejects(session.dust(),e=>walletError(e).includes('접근 권한'));assert.equal((await session.check()).address,address);assert.ok(!walletError({type:'DAppConnectorAPIError',code:'InternalError',reason:'secret'}).includes('secret'));denied=false;
 const history=await session.history(1);assert.equal(history[0].label,'실행 실패 포함');assert.equal(history[1].label,'전송 대기');assert.equal('txStatus' in history[0],false);
 address='changed-account';await assert.rejects(session.check(),/계정/);await assert.rejects(session.dust(),/다시 연결/);
 let resolve;const pending=session.connect({...choices[0],api:{...initial,connect:()=>new Promise(r=>{resolve=r;})}},'preprod');session.close();resolve(api);await assert.rejects(pending,/취소/);await assert.rejects(session.check(),/다시 연결/);
 await session.connect(choices[0],'preprod');let release;api.getDustBalance=()=>new Promise(r=>{release=r;});const late=session.dust();while(!release)await new Promise(r=>setImmediate(r));session.close();release({balance:1n,cap:1n});await assert.rejects(late,/취소/);
 console.log('PASS connector: versions, duplicates, scoped hints, bigint, permission denial, account changes, late responses, partial failure');
})().catch(e=>{console.error(e);process.exit(1)});
