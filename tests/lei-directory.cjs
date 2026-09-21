const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {lookupLei}=require('../lib/lei-directory.ts');const lei='529900T8BM49AURSDO55';
const fixture={data:{id:lei,attributes:{lei,entity:{legalName:{name:'Fixture Company'},jurisdiction:'FI',status:'ACTIVE',legalAddress:{addressLines:['Street 1'],city:'City',country:'FI',postalCode:'12345'}},registration:{status:'LAPSED',lastUpdateDate:'2025-01-01',nextRenewalDate:null}}}};
(async()=>{let calls=0;await assert.rejects(()=>lookupLei('00000000000000000000',async()=>{calls++;}),e=>e.status===400);assert.equal(calls,0);const result=await lookupLei(lei.toLowerCase(),async(url,options)=>{assert.equal(url,'https://api.gleif.org/api/v1/lei-records/'+lei);assert.equal(options.redirect,'error');return Response.json(fixture);});assert.equal(result.registrationStatus,'LAPSED');assert.equal(result.officialVleiVerified,false);assert.equal(result.nextRenewal,null);
for(const [status,expected] of [[404,404],[429,503],[500,503]])await assert.rejects(()=>lookupLei(lei,async()=>new Response('',{status})),e=>e.status===expected);
await assert.rejects(()=>lookupLei(lei,async()=>Response.json({...fixture,data:{...fixture.data,id:'wrong'}})),e=>e.status===503);
await assert.rejects(()=>lookupLei(lei,async()=>new Response('x'.repeat(262145))),e=>e.status===503);
await assert.rejects(()=>lookupLei(lei,async()=>Response.json({})),e=>e.status===503);
if(process.argv.includes('--live')){const live=await lookupLei(lei);assert.equal(live.lei,lei);assert.ok(live.legalName);console.log('LIVE official GLEIF record:',live.legalName,live.registrationStatus);}
console.log('PASS LEI checksum, fixed origin, normalization, response binding, failures, size limit and vLEI boundary');})().catch(e=>{console.error(e);process.exit(1)});
