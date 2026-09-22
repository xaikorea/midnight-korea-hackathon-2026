import type {ApplicationBatchOutcome} from './application-batch';
import type {ProcessRun,ProcessEvent} from './process-types';

export async function readProcessStream(response:Response,onRun:(run:ProcessRun)=>void){
  if(!response.ok){const body=await response.json() as {error?:string};throw Error(body.error??'서버 요청에 실패했습니다.');}
  if(!response.body||!response.headers.get('content-type')?.includes('application/x-ndjson'))throw Error('처리 기록 연결을 확인할 수 없습니다. 접수 상태를 다시 확인하세요.');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer='',run:ProcessRun|undefined,result:{outcomes:ApplicationBatchOutcome[]}|undefined,total=0;
  function consume(line:string){
    if(!line.trim())return;
    const item=JSON.parse(line) as {type:string;run?:ProcessRun;event?:ProcessEvent;batch?:{outcomes:ApplicationBatchOutcome[]};error?:string};
    if(item.type==='run'&&item.run){run=item.run;onRun(run);}
    else if(item.type==='event'&&run&&item.event){run={...run,updatedAt:item.event.at,events:[...run.events,item.event]};onRun(run);}
    else if((item.type==='complete'||item.type==='error')&&item.run){run=item.run;onRun(run);if(item.type==='error')throw Error(item.error??'결과를 저장하지 못했습니다.');result=item.batch;}
  }
  try{
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>4_000_000)throw Error('처리 기록이 너무 큽니다. 관제 창에서 다시 조회하세요.');buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()??'';for(const line of lines)consume(line);}
    buffer+=decoder.decode();consume(buffer);
    if(!result)throw Error('실시간 연결이 끊어졌습니다. 서버 처리가 계속될 수 있으니 결과를 다시 확인하세요.');
    return result;
  }finally{reader.releaseLock();}
}
