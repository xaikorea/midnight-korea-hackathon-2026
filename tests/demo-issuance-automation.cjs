const {spawnSync}=require('node:child_process');
const r=spawnSync(process.execPath,['tests/proof-jobs.cjs'],{stdio:'inherit',env:{...process.env,BIZPROOF_TEST_AUTOMATION:'true'}});process.exit(r.status??1);
