"use client";
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {sdkContractSchema} from '@/lib/midnight-sdk-schema';
import {z} from 'zod';
type Report=z.infer<typeof sdkContractSchema>;
export default function MidnightChainWatch({address,request,onReport}:{address:string;request:string;onReport:(report:Report)=>void}){
 const [watching,setWatching]=useState(false),[status,setStatus]=useState(''),[failed,setFailed]=useState(false);
 const valid=/^[a-f\d]{64}$/i.test(address)&&(!request||/^[a-f\d]{64}$/i.test(request));
 useEffect(()=>{
  if(!watching||!valid)return;
  let active=true,timer:ReturnType<typeof setTimeout>|undefined;
  const abort=new AbortController();
  async function refresh(){
   if(document.hidden){timer=setTimeout(()=>void refresh(),10000);return;}
   try{
    const response=await fetch('/api/midnight-sdk?address='+encodeURIComponent(address)+(request?'&request='+encodeURIComponent(request):''),{cache:'no-store',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])});
    if(!response.ok)throw Error('조회 실패');
    const report=sdkContractSchema.parse(await response.json());
    if(report.contractAddress.toLowerCase()!==address.toLowerCase()||(request&&report.found&&report.request?.id!==request.toLowerCase()))throw Error('조회 대상 불일치');
    if(!active)return;
    onReport(report);setFailed(false);setStatus('자동 조회 완료 · '+new Date(report.checkedAt).toLocaleTimeString('ko-KR'));
   }catch{
    if(!active)return;
    setFailed(true);setStatus('자동 조회가 중단되었습니다. 표시된 결과는 마지막 조회 시점의 기록입니다. 연결 상태를 확인한 뒤 다시 시작하세요.');setWatching(false);return;
   }
   if(active)timer=setTimeout(()=>void refresh(),10000);
  }
  void refresh();
  return()=>{active=false;abort.abort();if(timer)clearTimeout(timer);};
 },[watching,valid,address,request,onReport]);
 return <div className="compact-request"><div className="button-row"><Button variant="outline" disabled={!valid} onClick={()=>{setFailed(false);setStatus(watching?'자동 조회를 중지했습니다.':'체인 상태를 확인하고 있습니다.');setWatching(!watching);}}>{watching?'자동 조회 중지':'체인 자동 조회 시작'}</Button></div><p className="context-note">10초 간격으로 공개 상태를 조회합니다. 숨겨진 탭에서는 쉬고, 주소 변경·화면 이동 시 중지합니다. 거래를 생성하거나 재전송하지 않습니다.</p>{status&&<p role={failed?'alert':'status'}>{status}</p>}</div>;
}
