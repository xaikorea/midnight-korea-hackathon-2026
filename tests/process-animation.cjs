const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {processProjection,visibleProcessEvents,processFrameDelay}=require('../lib/process-visualization.ts');
const run={id:'synthetic-run',companyId:'c',companyName:'검증 기업',startedAt:'2026-09-23T00:00:00Z',updatedAt:'2026-09-23T00:00:00Z',status:'running',committed:false,historySaved:true,policies:[{id:'buyer',audience:'구매사'},{id:'grant',audience:'지원기관'}],events:[],engine:{signature:'Ed25519',policy:'local',networkConnected:false}};
function event(policyId,stage,state,data={}){const seq=run.events.length+1;const e={seq,policyId,stage,state,data,at:run.startedAt,elapsedMs:seq*2,message:'synthetic test event'};run.events.push(e);return e;}
const stage=(view,key)=>view.stages.find(s=>s.stage===key);
assert.equal(stage(processProjection(run),'credential').state,'pending');
event('buyer','credential','running');assert.equal(stage(processProjection(run),'credential').state,'running');
event('buyer','credential','success');const partial=stage(processProjection(run),'credential');assert.equal(partial.state,'incomplete');assert.equal(partial.seen,1);assert.equal(partial.rows[1].state,'pending');
event('grant','credential','running');event('grant','credential','failed');assert.equal(stage(processProjection(run),'credential').state,'failed');assert.equal(stage(processProjection(run,'buyer'),'credential').state,'success');assert.equal(stage(processProjection(run,'grant'),'credential').state,'failed');
event('buyer','policy','success',{eligible:false});assert.equal(stage(processProjection(run,'buyer'),'policy').state,'unmet');
event('buyer','verification','waiting');assert.equal(stage(processProjection(run,'buyer'),'verification').state,'waiting');
event('grant','request','success',{replayed:true});assert.equal(stage(processProjection(run,'grant'),'request').state,'reused');assert.equal(stage(processProjection(run,'grant'),'signature').state,'pending');
event(undefined,'commit','running');assert.equal(stage(processProjection(run,'buyer'),'commit').state,'running');const saved=event(undefined,'commit','success');run.status='partial';run.committed=true;
assert.equal(stage(processProjection(run),'commit').state,'success');assert.equal(stage(processProjection(run,'grant'),'commit').state,'success');assert.equal(stage(processProjection(run,'grant'),'credential').state,'failed');
// Reading an earlier frame must not show completion/other-recipient events from the future.
const prefix=processProjection(run,'all',2);assert.equal(prefix.focus.seq,2);assert.equal(prefix.events.length,2);assert.equal(stage(prefix,'commit').state,'pending');assert.equal(stage(prefix,'credential').rows[1].state,'pending');
assert.ok(visibleProcessEvents(run,'buyer').every(e=>!e.policyId||e.policyId==='buyer'));
assert.equal(processProjection(run,'buyer').focus.seq,saved.seq);
assert.equal(processFrameDelay({elapsedMs:10},{elapsedMs:11},1),700);assert.equal(processFrameDelay({elapsedMs:10},{elapsedMs:99999},1),1400);assert.equal(processFrameDelay({elapsedMs:10},{elapsedMs:11},2),350);
const skipped=structuredClone(run);skipped.events=[{...saved,state:'skipped'}];skipped.committed=false;skipped.status='failed';assert.equal(stage(processProjection(skipped),'commit').state,'skipped');
// An out-of-order transport cannot change playback order or fabricate event numbers.
const shuffled={...run,events:[...run.events].reverse()};assert.deepEqual(visibleProcessEvents(shuffled,'all').map(e=>e.seq),run.events.map(e=>e.seq));assert.equal(processProjection(shuffled).focus.seq,saved.seq);
console.log('PASS process animation: actual sequence prefixes, per-recipient state, partial/failure/manual/unmet, idempotent reuse, commit boundary, scoped events and bounded reading pace');
