import {spawnSync} from 'node:child_process';
const tests=process.argv.length>2?process.argv.slice(2):['review-regressions.cjs','supplier-navigation.cjs','supplier-profiles.cjs','issuance-studio.cjs','organization-trust.cjs','ssi-portal.cjs','identity-portal.cjs','credential-domains.cjs','midnight-wallet.cjs','dapp-connector.cjs','plan-improvements.cjs','get-vlei.cjs','lei-lookup-ui.cjs','workflow-exceptions-ui.cjs','submission-recovery-ui.cjs'];
for(const name of tests){const result=spawnSync(process.execPath,['tests/'+name],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);console.log('Completed '+name);}


