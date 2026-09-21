const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {profileVisible,companyView,profileInput}=require('../lib/supplier-profile.ts');
const c={id:'supplier',profile:{description:'Restricted business details',website:'',products:'',serviceRegions:'',visibility:'requested'}};
profileInput.parse(c.profile);
for(const status of ['pending','accepted','rejected']){
 const state={connections:[{companyId:c.id,kind:'buyer',status}]};
 assert.equal(profileVisible(state,c,'buyer'),status!=='rejected');
 assert.equal(profileVisible(state,c,'grant'),false);
 assert.equal(companyView(state,c,'grant').profile,undefined);
 assert.equal(profileVisible(state,{...c,profile:{...c.profile,visibility:'connected'}},'buyer'),status==='accepted');
}
assert.equal(profileVisible({connections:[]},c,'buyer'),false);
console.log('PASS requested visibility: pending/accepted allowed, rejected/unrelated denied, connected remains approval-only');
