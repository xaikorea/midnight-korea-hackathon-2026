import fs from 'node:fs';
const checks=await Promise.all([
 {id:'proof',url:'http://127.0.0.1:6300/version'},
 {id:'preprod-indexer',url:'https://indexer.preprod.midnight.network/api/v4/graphql',graphql:true},
].map(async p=>{try{const r=await fetch(p.url,{signal:AbortSignal.timeout(8000),redirect:'error',...(p.graphql?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'{ __typename }'})}:{})});let ok=r.ok;if(p.graphql){const body=await r.json();ok=ok&&typeof body.data?.__typename==='string'&&!body.errors;}else await r.body?.cancel();return {id:p.id,reachable:ok};}catch{return {id:p.id,reachable:false};}}));
const report={checkedAt:new Date().toISOString(),checks,walletBindingProvided:false,proofGenerated:false,contractDeployed:false,notice:'Readiness only. Funded preprod wallet bindings and compatible proof service are required to run contracts/sdk/reuse-scenario.ts.'};fs.mkdirSync('outputs',{recursive:true});fs.writeFileSync('outputs/midnight-live-readiness.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
