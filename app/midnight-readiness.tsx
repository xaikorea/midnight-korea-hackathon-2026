"use client";
import {useEffect,useRef,useState} from 'react';
import {discoverWallets,duplicateWallets,WalletSession,WalletSessionError,walletError,type WalletChoice,type WalletReport} from '@/lib/midnight-wallet';
import {Button} from '@/components/ui/button';
import {z} from 'zod';

type RuntimeReport={checkedAt:string;checks:{id:string;name:string;reachable:boolean;detail:string}[];proofGenerated:false;contractDeployed:false};
type History=Awaited<ReturnType<WalletSession['history']>>;
export default function MidnightReadiness(){
 const [wallets,setWallets]=useState<WalletChoice[]>([]),[selected,setSelected]=useState(''),[network,setNetwork]=useState('preprod'),[wallet,setWallet]=useState<WalletReport|null>(null),[runtime,setRuntime]=useState<RuntimeReport|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false);
 const [dust,setDust]=useState<{balance:string;cap:string}|null>(null),[history,setHistory]=useState<History|null>(null),[page,setPage]=useState(1);
 const session=useRef(new WalletSession()),epoch=useRef(0),working=useRef(false);
 function clear(){epoch.current++;session.current.close();setWallet(null);setDust(null);setHistory(null);setPage(1);setError('');working.current=false;setBusy(false);}
 async function run(action:()=>Promise<void>){if(working.current)return;const id=epoch.current;working.current=true;setBusy(true);setError('');try{await action();}catch(e){if(id===epoch.current){setError(walletError(e));if(e instanceof WalletSessionError){session.current.close();setWallet(null);setDust(null);setHistory(null);}}}finally{if(id===epoch.current){working.current=false;setBusy(false);}}}
 async function refresh(){const id=epoch.current;const report=await session.current.check();if(id===epoch.current)setWallet(report);}
 useEffect(()=>{const current=session.current,version=epoch;return()=>{version.current++;current.close();};},[]);
 useEffect(()=>{
  if(!wallet)return;
  const check=()=>{if(document.visibilityState==='visible'&&!working.current)void run(refresh);};
  const timer=setInterval(check,30000);window.addEventListener('focus',check);
  return()=>{clearInterval(timer);window.removeEventListener('focus',check);};
 // The effect captures the current wallet session and is replaced when its report changes.

 },[wallet]);
 async function connect(){await run(async()=>{const id=epoch.current,chosen=wallets.find(w=>w.id===selected);if(!chosen)throw new WalletSessionError('지갑을 선택하세요.');const report=await session.current.connect(chosen,network);if(id===epoch.current)setWallet(report);});}
 async function readDust(){setDust(null);await run(async()=>{const id=epoch.current;const value=await session.current.dust();if(id===epoch.current)setDust(value);});}
 async function readHistory(next:number){setHistory(null);await run(async()=>{const id=epoch.current;const value=await session.current.history(next);if(id===epoch.current){setHistory(value);setPage(next);}});}
 async function checkRuntime(){if(working.current)return;const id=epoch.current;working.current=true;setBusy(true);setError('');setRuntime(null);try{const r=await fetch('/api/midnight',{cache:'no-store'});const value=await r.json();if(!r.ok)throw Error(z.object({error:z.string()}).parse(value).error);const result=z.object({checkedAt:z.string(),checks:z.array(z.object({id:z.string(),name:z.string(),reachable:z.boolean(),detail:z.string()})),proofGenerated:z.literal(false),contractDeployed:z.literal(false)}).parse(value);if(id===epoch.current)setRuntime(result);}catch{if(id===epoch.current)setError('로컬 서비스 상태를 조회하지 못했습니다.');}finally{if(id===epoch.current){working.current=false;setBusy(false);}}}
 return <section className="panel bottom-panel">
  <div className="section-heading"><div><h2>Midnight 연결 준비</h2><p>지갑 연결, 로컬 서비스 응답, 실제 증명·체인 배포를 각각 확인합니다.</p></div><span className="status warn">실제 증명 미완료</span></div>
  <div className="reviewed-form"><label>사용할 네트워크<select aria-label="Midnight 네트워크" value={network} disabled={busy} onChange={e=>{clear();setNetwork(e.target.value);}}><option value="preprod">Preprod 테스트넷</option><option value="undeployed">로컬 standalone</option></select></label>
  <label>브라우저 지갑<select aria-label="Midnight 지갑" value={selected} disabled={busy} onChange={e=>{clear();setSelected(e.target.value);}}><option value="">지갑을 선택하세요</option>{wallets.map(w=><option key={w.id} value={w.id}>{w.name} · API {w.apiVersion} · {w.id.slice(0,8)}</option>)}</select></label></div>
  <div className="button-row"><Button variant="outline" disabled={busy} onClick={()=>{clear();const found=discoverWallets((window as Window & {midnight?:unknown}).midnight);setWallets(found);setSelected('');setSearched(true);}}>설치된 지갑 찾기</Button><Button disabled={busy||!selected||!!wallet} onClick={()=>void connect()}>지갑 연결 요청</Button><Button variant="outline" disabled={busy} onClick={()=>void checkRuntime()}>로컬 서비스 확인</Button>{(wallet||busy)&&<Button variant="ghost" onClick={clear}>화면 연결 종료</Button>}</div>
  <p className="small-text muted">연결 시 네트워크·서비스 설정·주소 조회를 요청합니다. DUST와 거래 내역은 아래 버튼을 눌렀을 때만 조회합니다. 화면 연결 종료 후에도 지갑의 사이트 권한은 지갑 설정에서 직접 해제해야 합니다.</p>
  {searched&&!wallets.length&&<p>이 브라우저에서 지원하는 Midnight 지갑을 찾지 못했습니다. API 4.x 지갑 확장 프로그램을 설치한 브라우저에서 다시 확인하세요.</p>}
  {duplicateWallets(wallets)&&<p role="alert">이름 또는 식별자가 같은 지갑이 여러 개 발견되었습니다. 설치한 확장 프로그램과 지갑 식별자를 확인하세요.</p>}
  {selected&&<p className="small-text muted">지갑 식별자: {wallets.find(w=>w.id===selected)?.rdns} · {selected}</p>}
  {error&&<p role="alert">{error}</p>}
  {wallet&&<div className="compact-request"><b>지갑 연결 확인 · {wallet.network}</b><p className="journey-id">{wallet.address}</p><p>인덱서: {wallet.indexer} · 노드: {wallet.node} · 증명: {wallet.prover}</p><small>{new Date(wallet.checkedAt).toLocaleString('ko-KR')} 확인. 주소와 조회 결과는 이 화면의 메모리에만 보관합니다.</small>
   <div className="button-row"><Button variant="ghost" disabled={busy} onClick={()=>void run(refresh)}>지갑 상태 다시 확인</Button><Button variant="outline" disabled={busy} onClick={()=>void readDust()}>DUST 잔액 조회</Button><Button variant="outline" disabled={busy} onClick={()=>void readHistory(1)}>거래 내역 조회</Button></div>
   {dust&&<p>DUST 잔액(원시 단위): {dust.balance} · 생성 한도: {dust.cap}<br/><small>이 값만으로 특정 거래의 수수료 충족 여부를 판단하지 않습니다.</small></p>}
   {history&&<div aria-live="polite"><b>지갑 거래 내역 · {page}페이지</b><p>지갑 전체의 거래 기록이며, BizProof 자격 검증 결과와 자동으로 연결하지 않습니다.</p>{history.length?history.map((item,i)=><div className="check-row" key={item.hash+':'+i}><div><p className="journey-id">{item.hash}</p><b>{item.label}</b></div></div>):<p>이 페이지에 거래가 없습니다.</p>}<div className="button-row"><Button variant="outline" disabled={busy||page<=1} onClick={()=>void readHistory(page-1)}>이전 거래 페이지</Button><Button variant="outline" disabled={busy||history.length<5||page>=1000} onClick={()=>void readHistory(page+1)}>다음 거래 페이지</Button></div></div>}
  </div>}
  {runtime&&<div aria-live="polite">{runtime.checks.map(c=><div className="check-row" key={c.id}><div><b>{c.name}</b><p>{c.detail}</p></div><span className={'status '+(c.reachable?'good':'warn')}>{c.reachable?'서비스 응답 확인':'응답 확인 안 됨'}</span></div>)}<small>{new Date(runtime.checkedAt).toLocaleString('ko-KR')} · 서버의 로컬 개발 서비스 검사</small></div>}
  <p className="context-note">지갑 연결과 거래 내역의 확정 표시는 기업 자격 인증·컨트랙트 배포·ZK 증명의 완료를 의미하지 않습니다. 이 화면은 조회용이며 거래 서명·전송 버튼은 아직 연결하지 않았습니다.</p>
 </section>;
}


