// Export only the public DTO; never copy private directories, raw source claims or SDK payloads.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),crypto=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {midnightEvidenceSchema}=require('../lib/midnight-evidence.ts');
const source=process.argv[2]??'outputs/midnight-web-devnet/report.json';
const report=midnightEvidenceSchema.parse(JSON.parse(fs.readFileSync(source,'utf8')));
const target=path.resolve('public/evidence/midnight-web-devnet.json');fs.mkdirSync(path.dirname(target),{recursive:true});
const body=JSON.stringify(report,null,2)+'\n';fs.writeFileSync(target,body);
console.log(JSON.stringify({file:'public/evidence/midnight-web-devnet.json',sha256:crypto.createHash('sha256').update(body).digest('hex'),receipts:report.receipts.length,requests:report.outcomes.map(o=>({scenario:o.scenario,requestId:o.requestId})),completedAt:report.completedAt}));
