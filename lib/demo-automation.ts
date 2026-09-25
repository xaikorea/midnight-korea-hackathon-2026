/** Server-owned opt-in. Never trust a browser-supplied role or approval flag. */
export function demoAutomationEnabled(){return process.env.BIZPROOF_PUBLIC_DEMO==='true'&&process.env.BIZPROOF_DEMO_AUTO_RUN==='true';}
export function automaticDemoOwner(owner:string){return demoAutomationEnabled()&&/^demo-[a-f0-9-]{36}$/.test(owner);}
export const demoApprovalActor='system:public-synthetic-demo:v1';
