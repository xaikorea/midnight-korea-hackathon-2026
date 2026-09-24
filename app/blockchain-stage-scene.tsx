'use client';
import type {CSSProperties} from 'react';
import {Pause,Play} from 'lucide-react';
import type {BlockchainNode,BlockchainState} from '@/lib/blockchain-visualization';
import './blockchain-stage-scene.css';

const captions:Record<BlockchainNode,{title:string;description:string}>={
  source:{title:'서명된 기업 자격을 확인합니다',description:'문서 원본과 서명을 확인하고 같은 기업 속성을 증명용 자격에 연결합니다.'},
  proof:{title:'원본 값을 공개하지 않고 증명을 만듭니다',description:'비공개 입력과 조건 회로로 증명을 생성합니다. 입자의 이동은 계산 원리를 설명하는 표현입니다.'},
  balance:{title:'지갑에서 거래와 수수료 자원을 준비합니다',description:'지갑 SDK가 거래를 구성하고 DUST 자원을 확인합니다. 그림은 실제 잔액이나 처리율을 표시하지 않습니다.'},
  submission:{title:'증명이 포함된 거래를 노드로 보냅니다',description:'거래 전송과 블록 확정은 별도 단계입니다. 전송 애니메이션만으로 확정되었다고 판단하지 않습니다.'},
  finality:{title:'블록에 반영된 결과를 확인합니다',description:'확정 영수증과 인덱서 조회로 결과를 대조합니다. 확인 표시는 해당 기록에 확정 영수증이 있을 때만 나타납니다.'},
};
const documentShape=<><rect x="122" y="26" width="94" height="124" rx="10" className="scene-paper"/><path d="M142 51h40M142 70h52M142 87h42M142 104h34" className="scene-document-lines"/><circle cx="188" cy="128" r="11" className="scene-seal"/></>;

export default function BlockchainStageScene({stage,state,moving,previewing,reduced,speed,blockHeight,onToggle}:{stage:BlockchainNode;state:BlockchainState;moving:boolean;previewing:boolean;reduced:boolean;speed:number;blockHeight?:number;onToggle:()=>void}){
  const blocked=state==='blocked',confirmed=stage==='finality'&&state==='complete'&&blockHeight!==undefined;
  const scene=blocked?'blocked':stage;
  const copy=blocked?{title:'취소된 자격의 재사용을 차단합니다',description:'제출 전 회로 검사에서 중단된 기록입니다. 새로운 증명이나 성공 거래는 생성되지 않습니다.'}:captions[stage];
  return <div className="chain-stage-scene" data-scene={scene} data-moving={moving?'on':'off'} data-mode={previewing?'explanation':'record'} data-confirmed={confirmed} style={{'--scene-cycle':`${2.4/speed}s`} as CSSProperties}>
    <div className="chain-scene-heading"><div><span>{previewing?'단계 설명 재생 · 실행 위치 고정':'실행 기록에 맞춘 단계별 애니메이션'}</span><h3>{copy.title}</h3></div><button type="button" disabled={reduced} onClick={onToggle}>{moving?<Pause size={14}/>:<Play size={14}/>} {moving?'단계 애니메이션 일시정지':'이 단계 동작 재생'}</button></div>
    <svg className="chain-scene-art" viewBox="0 0 640 188" aria-hidden="true">
      <path d="M36 169h568" className="scene-ground"/>
      {scene==='source'&&<>
        <g className="scene-document">{documentShape}<rect x="130" y="31" width="78" height="3" rx="1.5" className="scene-scan"/></g>
        <path d="M234 90h150" className="scene-route"/><g className="scene-source-packet"><rect x="246" y="83" width="22" height="14" rx="5"/><path d="M252 89h10"/></g>
        <rect x="410" y="42" width="108" height="106" rx="18" className="scene-core"/><path d="M464 59l27 10v24c0 18-27 31-27 31s-27-13-27-31V69z" className="scene-shield"/>
        {state==='complete'?<path d="M451 91l9 9 18-20" className="scene-check"/>:<path d="M453 88h22M453 97h14" className="scene-document-lines"/>}
        <text x="169" y="181">서명된 기업 자격</text><text x="464" y="181">{state==='complete'?'원본 서명 확인 기록':'서명·원본 확인'}</text>
      </>}
      {scene==='proof'&&<>
        <g className="scene-inputs"><rect x="50" y="32" width="116" height="31" rx="8"/><rect x="50" y="78" width="116" height="31" rx="8"/><rect x="50" y="124" width="116" height="31" rx="8"/><text x="108" y="52">매출 ••••</text><text x="108" y="98">설립일 ••••</text><text x="108" y="144">지역 ••••</text></g>
        <path d="M174 47h37l55 45M174 94h92M174 139h37l55-45M374 94h94" className="scene-circuit"/>
        <circle cx="320" cy="94" r="49" className="scene-core"/><circle cx="320" cy="94" r="61" className="scene-orbit"/><g className="scene-orbit-dot"><circle cx="320" cy="33" r="5"/></g><text x="320" y="101" className="scene-zk">ZK</text>
        <g className="scene-proof-output"><rect x="478" y="58" width="113" height="72" rx="13" className="scene-core"/><path d="M492 77h35M492 91h78M492 105h57" className="scene-document-lines"/></g>
        <text x="320" y="180">Compact 조건 회로</text><text x="534" y="157">증명 데이터</text>
      </>}
      {scene==='balance'&&<>
        <g className="scene-fee scene-fee-one"><circle cx="124" cy="75" r="18"/><text x="124" y="79">D</text></g><g className="scene-fee scene-fee-two"><circle cx="170" cy="111" r="13"/><text x="170" y="115">D</text></g>
        <path d="M193 91h66" className="scene-route"/><rect x="269" y="54" width="143" height="94" rx="16" className="scene-core"/><path d="M270 74h141M293 53V40h94v14" className="scene-document-lines"/><rect x="368" y="87" width="62" height="32" rx="9" className="scene-wallet-flap"/><circle cx="385" cy="103" r="4"/>
        <g className="scene-fee-bars"><rect x="479" y="107" width="14" height="35" rx="4"/><rect x="502" y="86" width="14" height="56" rx="4"/><rect x="525" y="64" width="14" height="78" rx="4"/></g>
        <text x="340" y="178">Wallet SDK · 거래 준비</text><text x="128" y="153">DUST 자원</text><text x="512" y="166">자원 확인 개념도</text>
      </>}
      {scene==='submission'&&<>
        <rect x="54" y="47" width="100" height="95" rx="15" className="scene-core"/><path d="M77 68h54M77 87h43M77 106h29" className="scene-document-lines"/>
        <path d="M164 92h269" className="scene-route"/><path d="M422 85l10 7-10 7" className="scene-document-lines"/>
        <g className="scene-tx-packet"><rect x="173" y="80" width="43" height="24" rx="7"/><text x="194" y="96">TX</text></g>
        <g className="scene-node"><rect x="462" y="42" width="118" height="33" rx="8" className="scene-core"/><rect x="462" y="83" width="118" height="33" rx="8" className="scene-core"/><rect x="462" y="124" width="118" height="22" rx="7" className="scene-core"/><circle cx="479" cy="58" r="3" className="scene-signal"/><circle cx="479" cy="99" r="3" className="scene-signal"/><path d="M495 58h61M495 99h61" className="scene-document-lines"/></g>
        <text x="104" y="177">증명을 포함한 거래</text><text x="521" y="177">Midnight 노드</text>
      </>}
      {scene==='finality'&&<>
        <path d="M221 88h69M382 88h70" className="scene-block-link"/>
        <rect x="130" y="46" width="91" height="88" rx="13" className="scene-old-block"/><rect x="291" y="46" width="91" height="88" rx="13" className="scene-old-block"/><path d="M150 65h48M150 81h36M150 97h45M310 65h51M310 81h37M310 97h43" className="scene-document-lines"/>
        <g className={confirmed?'scene-new-block':'scene-waiting-block'}><rect x="452" y="39" width="108" height="103" rx="16" className="scene-core"/>{confirmed?<path d="M480 88l17 16 31-37" className="scene-check"/>:<><circle cx="506" cy="85" r="21" className="scene-orbit"/><path d="M506 71v16l10 7" className="scene-document-lines"/></>}</g>
        <text x="175" y="166">기존 블록</text><text x="336" y="166">블록 연결</text><text x="506" y="166">{confirmed?`확정 #${blockHeight}`:'확정 영수증 대기'}</text>
      </>}
      {scene==='blocked'&&<>
        <g className="scene-rejected-document">{documentShape}</g><path d="M231 90h230" className="scene-route"/>
        <g className="scene-blocked-packet"><rect x="241" y="81" width="30" height="18" rx="5"/></g>
        <g className="scene-stop"><rect x="304" y="33" width="42" height="113" rx="12"/><path d="M315 79l20 22M335 79l-20 22"/></g>
        <rect x="453" y="49" width="99" height="91" rx="12" className="scene-skipped"/><path d="M479 73l46 46M525 73l-46 46" className="scene-skipped-cross"/>
        <text x="166" y="178">취소된 자격</text><text x="325" y="174">제출 전 차단</text><text x="502" y="178">새 거래 없음</text>
      </>}
    </svg>
    <p className="chain-scene-caption">{copy.description}</p>
    <small className="chain-scene-note">{reduced?'동작 줄이기 설정으로 정지 화면을 표시합니다.':previewing?'선택한 기술의 설명 애니메이션입니다. 실행 위치와 거래 결과는 바뀌지 않습니다.':'동작 원리를 표현한 장면입니다. 실제 계산 시간·노드 수·자원량과는 다릅니다.'}</small>
  </div>;
}
