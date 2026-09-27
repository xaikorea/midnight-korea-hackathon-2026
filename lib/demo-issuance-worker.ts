import {recoverDemoIssuanceJobs} from './demo-issuance-jobs';

/** NHN Node process lifecycle; SQLite leases coordinate server instances and POST requests. */
export function startDemoIssuanceWorker(){
 const host=globalThis as typeof globalThis&{bizproofIssuanceTimer?:ReturnType<typeof setInterval>};
 if(host.bizproofIssuanceTimer)return;
 let running=false;
 const tick=async()=>{if(running)return;running=true;try{await recoverDemoIssuanceJobs();}catch{console.warn('Synthetic issuance recovery temporarily unavailable');}finally{running=false;}};
 host.bizproofIssuanceTimer=setInterval(()=>void tick(),15000);host.bizproofIssuanceTimer.unref?.();
 const initial=setTimeout(()=>void tick(),1000);initial.unref?.();
}
