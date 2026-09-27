export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.BIZPROOF_PUBLIC_DEMO==='true'&&process.env.BIZPROOF_DEMO_AUTO_RUN==='true'&&process.env.BIZPROOF_ISSUER_URL){
  const {startDemoIssuanceWorker}=await import('./lib/demo-issuance-worker');startDemoIssuanceWorker();
 }
}
