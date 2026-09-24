const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {midnightEvidenceSchema}=require('../lib/midnight-evidence.ts');
const sample=JSON.parse(fs.readFileSync('public/evidence/midnight-web-devnet.json','utf8'));
assert.ok(midnightEvidenceSchema.safeParse(sample).success);
function reject(edit){const value=structuredClone(sample);edit(value);assert.equal(midnightEvidenceSchema.safeParse(value).success,false);}
reject(r=>r.receipts[1].contractAddress='00'.repeat(32));
reject(r=>r.outcomes[0].credentialId='unrelated-credential');
reject(r=>r.outcomes[2].inspection.request.eligible=true);
reject(r=>r.webResults[0].requestId='unrelated-request');
reject(r=>r.receipts=r.receipts.filter(x=>x.operation!=='revokeCredential'));
reject(r=>r.events=r.events.filter(x=>x.stage!=='proof'));
const injected={...sample,privateKey:'must-not-be-exported',source:{...sample.source,claims:{revenue:123}}};
const safe=midnightEvidenceSchema.parse(injected);assert.equal('privateKey' in safe,false);assert.equal('claims' in safe.source,false);
console.log('PASS evidence: source/contract/request/receipt binding, negative and revocation results, proof trace, public field allowlist');
