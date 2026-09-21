"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {ViewState} from '@/lib/domain';
class SessionError extends Error {}
async function readWorkspace(signal:AbortSignal){
 const response=await fetch('/api/platform',{cache:'no-store',signal});
 if(response.status===401)throw new SessionError('다시 로그인하세요.');
 const value=await response.json() as ViewState & {error?:string};
 if(!response.ok)throw new Error(value.error??'데이터를 불러올 수 없습니다.');
 return value;
}
export function useWorkspace(){
 const [state,setState]=useState<{data:ViewState|null;error:string;unauthorized:boolean}>({data:null,error:'',unauthorized:false});
 const controller=useRef<AbortController|null>(null);
 const start=useCallback(()=>{controller.current?.abort();const next=new AbortController();controller.current=next;return next;},[]);
 const receive=useCallback((next:AbortController,data:ViewState)=>{if(next.signal.aborted)return false;setState({data,error:'',unauthorized:false});return true;},[]);
 const reject=useCallback((next:AbortController,error:unknown)=>{if(!next.signal.aborted)setState({data:null,error:error instanceof Error?error.message:'데이터를 불러올 수 없습니다.',unauthorized:error instanceof SessionError});return false;},[]);
 const reload=useCallback(async()=>{const next=start();try{return receive(next,await readWorkspace(next.signal));}catch(error){return reject(next,error);}},[start,receive,reject]);
 const load=useCallback(async()=>{await reload();},[reload]);
 const invalidate=useCallback(()=>{controller.current?.abort();setState({data:null,error:'',unauthorized:false});},[]);
 useEffect(()=>{const next=start();readWorkspace(next.signal).then(data=>receive(next,data),error=>reject(next,error));return()=>next.abort();},[start,receive,reject]);
 return {...state,load,reload,invalidate};
}
