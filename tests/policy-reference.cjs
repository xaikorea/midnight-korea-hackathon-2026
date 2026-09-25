const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {evaluate,policyInput,canonical}=require('../lib/domain.ts');
const {foundingCutoff}=require('../lib/compact-policy.ts');
const {checkedInput}=require('../lib/input-validation.ts');
const {evaluateOpa}=require('../lib/opa.ts');
const {formDefinition,formAjv}=require('../lib/form-schema.ts');
const {assertAgeProofSupported}=require('../lib/policy-age.ts');
const base={name:'synthetic policy',audience:'synthetic recipient',kind:'grant',minRevenue:null,maxRevenue:null,maxAgeMonths:84,region:null,requireCertification:false,issuerIds:['fixture']};
const claims={revenue:0,foundedOn:'2019-09-04',region:'경기',certified:false};
const fixed={...base,ageReferenceDate:'2026-09-03',ageComparison:'lt',sourceUrl:'https://example.com/notice',sourceVersion:'fixture 2026'};
const before=new Date('2026-09-03T00:00:00Z'),later=new Date('2026-09-25T15:00:00Z');
assert.equal(evaluate(claims,base,before).eligible,true);
assert.equal(evaluate(claims,base,later).eligible,false);
assert.equal(evaluate(claims,fixed,before).eligible,true);
assert.deepEqual(evaluate(claims,fixed,before),evaluate(claims,fixed,later));
assert.equal(evaluate({...claims,foundedOn:'2019-09-03'},fixed,later).eligible,false);
assert.equal(evaluate({...claims,foundedOn:'2019-09-03'},{...fixed,ageComparison:'lte'},later).eligible,true);
assert.equal(evaluate({...claims,foundedOn:'2020-02-29'},{...fixed,maxAgeMonths:12,ageReferenceDate:'2021-02-28'},later).eligible,false);
assert.equal(evaluate({...claims,foundedOn:'2020-02-29'},{...fixed,maxAgeMonths:12,ageReferenceDate:'2021-02-28',ageComparison:'lte'},later).eligible,true);
// Full boundary windows must agree with the lower-bound value given to Compact.
for(const reference of ['2026-09-03','2024-02-29','2026-03-01']) for(const comparison of ['lt','lte']) for(const months of [0,1,12,84]){
  const p={...fixed,ageReferenceDate:reference,ageComparison:comparison,maxAgeMonths:months},cut=foundingCutoff(p,later);
  for(let day=cut-40;day<=cut+40;day++) {
    const foundedOn=new Date(day*864e5).toISOString().slice(0,10);
    assert.equal(evaluate({...claims,foundedOn},p,later).eligible,day>=cut&&foundedOn<=reference);
    if(foundedOn>reference)assert.throws(()=>assertAgeProofSupported(foundedOn,p),/기준일 이후/);
    else assert.doesNotThrow(()=>assertAgeProofSupported(foundedOn,p));
  }
}
assert.deepEqual(policyInput.parse(checkedInput('policy',fixed)),fixed);
assert.deepEqual(policyInput.parse(base),base); // Do not insert defaults into old signed policies.
assert.notEqual(canonical(fixed),canonical({...fixed,ageComparison:'lte'}));
for(const p of [{...base,ageComparison:'lt'},{...base,ageReferenceDate:'2026-09-03'},{...fixed,maxAgeMonths:null},{...fixed,ageReferenceDate:'2026-02-30'},{...base,sourceUrl:'https://example.com'}]){
  assert.throws(()=>checkedInput('policy',p));assert.equal(policyInput.safeParse(p).success,false);
}
for(const url of ['not a url','javascript:alert(1)','https://user:password@example.com']) assert.equal(policyInput.safeParse({...fixed,sourceUrl:url}).success,false);
const future=formDefinition([{name:'ageReferenceDate',label:'기준일',type:'date',allowFuture:true}]);
assert.equal(formAjv.compile(future.schema)({ageReferenceDate:'2099-06-10'}),true);
(async()=>{
  let calls=0;
  const fetcher=async(_url,init)=>{
    calls++;const {binding,facts:f,conditions:p}=JSON.parse(init.body).input;
    const checks={minRevenue:p.minRevenue===null||f.revenue>=p.minRevenue,maxRevenue:p.maxRevenue===null||f.revenue<=p.maxRevenue,age:f.deadline===null||f.now<=f.deadline,region:!p.region||f.region===p.region,certification:!p.requireCertification||f.certified};
    return Response.json({result:{revision:'bizproof-eligibility-v1',binding,checks,eligible:Object.values(checks).every(Boolean)}});
  };
  for(const comparison of ['lt','lte'])for(const foundedOn of ['2019-09-03','2026-09-04']){
    const p={...fixed,ageComparison:comparison},c={...claims,foundedOn};
    assert.deepEqual(await evaluateOpa(c,p,later,{address:'http://localhost:8181',fetcher}),evaluate(c,p,later));
  }
  assert.equal(calls,4);
  console.log('PASS policy reference: fixed dates, strict boundaries, leap/month-end parity, legacy hashes, source validation, future dates and OPA parity.');
})().catch(e=>{console.error(e);process.exitCode=1;});
