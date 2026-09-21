"use client";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {parseKeriaFile,type KeriaSnapshot,type KeriaPresentation} from '@/lib/keria-import';
import {vleiExpectedSchema,type VleiExpected} from '@/lib/vlei-verifier';

export default function KeriaPanel({disabled,onSelect,onPresentation}:{disabled:boolean;onSelect:(expected:VleiExpected)=>void;onPresentation:(value:KeriaPresentation)=>void}) {
 const [snapshot,setSnapshot]=useState<KeriaSnapshot|null>(null),[presentation,setPresentation]=useState<KeriaPresentation|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
 async function load(file:File|undefined){if(!file)return;const turn=++generation.current;setLoading(true);setError('');setSnapshot(null);setPresentation(null);
  try{if(file.size>400000)throw Error('파일은 400KB 이하여야 합니다.');const value=parseKeriaFile(await file.text());if(turn!==generation.current)return;if(value.format==='bizproof-keria-snapshot-v1')setSnapshot(value);else setPresentation(value);}
  catch{if(turn===generation.current)setError('KERIA 파일 형식·크기를 확인하세요. 원본 지갑이나 비밀키 파일은 가져올 수 없습니다.');}
  finally{if(turn===generation.current)setLoading(false);}
 }
 const observed=snapshot?.observedAt||presentation?.observedAt;
 return <div className="panel bottom-panel" style={{minWidth:0,overflowWrap:'anywhere'}}><div className="section-heading"><div><h3>KERIA 자격 가져오기</h3><p>로컬 Signify 도구에서 내보낸 식별자·자격을 검증 입력으로 연결합니다.</p></div><span className="status warn">파일 자료 · 진위 미검증</span></div>
 <details><summary>로컬 에이전트 사용 방법</summary><p>프로젝트의 integrations/keria에서 npm ci 후 node edge.mjs --help를 실행하세요. 기존 에이전트 주소와 AID를 설정하고 로컬 터미널에서 패스코드를 입력합니다. snapshot은 목록, presentation은 선택한 자격의 CESR, sign은 권한 조회 서명 파일을 만듭니다.</p><p>브라우저에 패스코드나 개인키를 입력하지 마세요. 파일의 내용은 수정될 수 있으므로 가져오기만으로 검증·기업 권한이 부여되지 않습니다.</p></details>
 <label className="field wide">KERIA 내보내기 파일<input type="file" accept=".json,application/json" aria-label="KERIA 내보내기 파일" disabled={disabled||loading} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void load(file);}}/></label>
 {observed&&<p>도구 기록 시각: {new Date(observed).toLocaleString('ko-KR')} · 현재 상태는 검증기에 다시 확인해야 합니다.</p>}
 {snapshot&&<><p>목록 시작 위치 {snapshot.offset} · 식별자 {snapshot.identifiers.length}개 · 자격 {snapshot.credentials.length}개</p>
 <ul>{snapshot.identifiers.map((v,i)=><li key={i}>{v.name} · <code>{v.aid}</code></li>)}</ul>
 {snapshot.credentials.map((vc,i)=>{const candidate=vleiExpectedSchema.safeParse({aid:vc.aid,said:vc.said,lei:vc.lei,role:vc.role});const revoked=['rev','brv'].includes(vc.registryEvent);return <div className="panel" key={i}><b>{vc.lei||'LEI 없음'} · {vc.role||'역할 없음'}</b><p>SAID: <code>{vc.said}</code></p><p>발급자: <code>{vc.issuer}</code></p><p>에이전트 기록: {revoked?'취소됨':vc.registryEvent==='unknown'?'상태 미상':'발급 기록 있음 · 유효성 별도 확인'}</p><Button variant="outline" disabled={disabled||revoked||!candidate.success} onClick={()=>{if(candidate.success)onSelect(candidate.data);}}>이 자격을 조회 대상으로 선택</Button></div>;})}
 {(snapshot.moreIdentifiers||snapshot.moreCredentialsPossible)&&<p>다음 페이지가 있을 수 있습니다. snapshot 명령의 offset을 {snapshot.offset+25}로 지정해 가져오세요.</p>}</>}
 {presentation&&<div><p>기업 LEI: {presentation.expected.lei} · 역할: {presentation.expected.role}</p><p>SAID: <code>{presentation.expected.said}</code></p><p>CESR에 기업·담당자 정보가 포함될 수 있습니다. 검증기로 전송하기 전에 아래 제출 동의를 확인하세요.</p><Button disabled={disabled} onClick={()=>{onPresentation(presentation);setPresentation(null);}}>CESR를 검증 입력으로 가져오기</Button></div>}
 {error&&<p role="alert">{error}</p>}<Button variant="ghost" disabled={disabled||loading} onClick={()=>{generation.current++;setSnapshot(null);setPresentation(null);setError('');}}>KERIA 가져온 자료 지우기</Button>
 </div>;
}
