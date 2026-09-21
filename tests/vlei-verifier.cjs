const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {vleiClient,validLei,vleiHeadersSchema}=require('../lib/vlei-verifier.ts');
(async()=>{
 const expected={aid:'E'+'a'.repeat(43),said:'E'+'b'.repeat(43),lei:'5493001KJTIIGC8Y1R12',role:'Procurement Officer'},headers={'signature-input':'signify=("@method" "@path" "signify-resource" "signify-timestamp");created='+Math.floor(Date.now()/1000),'signature':'test-signature','signify-resource':expected.aid,'signify-timestamp':new Date().toISOString()};
 assert.ok(validLei(expected.lei));assert.equal(validLei(expected.lei.slice(0,19)+'3'),false);assert.equal(validLei('../../private'),false);
 let status=202,data={aid:expected.aid,said:expected.said,msg:'secret-field'},calls=[];
 const client=vleiClient(async(url,init)=>{calls.push({url,init});return status===205?new Response(null,{status}):Response.json(data,{status});});
 const accepted=await client.present(expected,'fictional-cesr');assert.equal(accepted.authorizationMatched,false);assert.equal(accepted.officialVleiVerified,false);assert.equal(accepted.status,'accepted');assert.equal(calls[0].init.headers['content-type'],'application/json+cesr');assert.equal(calls[0].init.body,'fictional-cesr');assert.equal(calls[0].init.redirect,'manual');assert.ok(!JSON.stringify(accepted).includes('secret-field'));
 status=200;data={...expected};const matched=await client.authorize(expected,headers);assert.equal(matched.authorizationMatched,true);assert.equal(matched.officialVleiVerified,false);assert.equal(matched.checks.length,4);assert.equal(calls.at(-1).init.headers.signature,headers.signature);
 data={aid:expected.aid,said:expected.aid,lei:null,role:null};assert.equal((await client.authorize(expected,headers)).status,'mismatch');
 for(const key of ['aid','said','lei','role']){data={...expected,[key]:key==='lei'?'213800D1EI4B9WTWWD28':key==='role'?'Different Role':'E'+'z'.repeat(43)};assert.equal((await client.authorize(expected,headers)).authorizationMatched,false);}
 for(const code of [400,401,403,404]){status=code;data={msg:'sensitive rejection'};const result=await client.authorize(expected,headers);assert.equal(result.authorizationMatched,false);assert.ok(!JSON.stringify(result).includes('sensitive rejection'));}
 status=302;await assert.rejects(client.authorize(expected,headers),/리디렉션/);status=200;data={};await assert.rejects(client.authorize(expected,headers),/필요한/);
 const before=calls.length;await assert.rejects(client.authorize(expected,{...headers,'signify-resource':'E'+'x'.repeat(43)}),/대상/);assert.equal(calls.length,before);
 assert.equal(vleiHeadersSchema.safeParse({...headers,host:'evil.invalid'}).success,false);assert.equal(vleiHeadersSchema.safeParse({...headers,signature:'abc\r\nHost: x'}).success,false);
 const unavailable=vleiClient(async()=>{throw Error('secret network path');});assert.equal((await unavailable.readiness()).reachable,false);await assert.rejects(unavailable.present(expected,'data'),/연결/);
 const oversized=vleiClient(async()=>new Response('x'.repeat(33000)));await assert.rejects(oversized.authorize(expected,headers),/너무 큽/);
 
 const {checkSignedQuery}=require('../lib/vlei-verifier.ts');const now=Date.now();checkSignedQuery(expected,headers,now);
 for(const patch of [
 {'signify-timestamp':'not-a-time'},
 {'signature-input':'signify=("@method" "@path");created='+Math.floor(now/1000)},
 {'signature-input':headers['signature-input']+';created='+Math.floor(now/1000)},
 {'signature-input':headers['signature-input']+';expires='+Math.floor((now-10000)/1000)},
 {'signify-timestamp':new Date(now-600000).toISOString(),'signature-input':'signify=("@method" "@path" "signify-resource" "signify-timestamp");created='+Math.floor((now-600000)/1000)}
 ])assert.throws(()=>checkSignedQuery(expected,{...headers,...patch},now));
 for(const [code,expectedStatus] of [[202,'processing'],[205,'aged-off'],[400,'not-found'],[404,'not-found']]){status=code;data={msg:'PRIVATE-SENTINEL witness secret'};const report=await client.status(expected);assert.equal(report.status,expectedStatus);assert.equal(report.authorizationMatched,false);assert.ok(!JSON.stringify(report).includes('PRIVATE-SENTINEL'));assert.equal(calls.at(-1).url.endsWith('/presentations/'+expected.said),true);}
 status=500;await assert.rejects(client.status(expected));
 console.log('PASS vLEI: CESR media type, 202 pending, AID-only rejection, four identity bindings, signed headers, no redirect, errors, response limits, LEI checksum');
})().catch(e=>{console.error(e);process.exit(1)});
