"use client";
import {useState} from 'react';
import {ArrowUpRight,BookOpen,Search} from 'lucide-react';
import {guideTopics,guideFaq,guideUpdatedAt} from '@/lib/user-guide';
import './user-guide.css';

const paths = [
 ['기업 담당자','대상 선택 → 공유 확인·제출 → 결과','apply'],
 ['처리 과정 확인','실제 결과 → 기록 재생 → 검사 근거','process'],
 ['발급·검증 담당자','검토 대기·서명 발급 / 기관 정책·확인','studio'],
 ['서비스 관리자','방문·고객 분석 → 비밀번호 관리','analytics'],
];
const glossary = [
 ['자격 (Credential)','발급기관이 기업의 속성에 서명한 전자 증명서입니다.'],
 ['정책 (Policy)','기관이 확인하려는 조건의 묶음입니다. 예를 들어 매출 2억 원 이상입니다.'],
 ['제출 결과 (Presentation)','특정 요청과 수신 기관을 위해 만든 조건 확인 결과입니다. 자격 원본과 다릅니다.'],
 ['발급기관 (Issuer)','기업 정보를 검토하고 자격에 서명하는 주체입니다.'],
 ['업무 권한','담당자가 해당 기업을 위해 어떤 일을 할 수 있는지 나타내는 증명입니다.'],
 ['처리·저장 완료','접수 결과를 서버에 저장했다는 뜻입니다. 조건 충족 여부와 기관의 최종 결정은 별도로 확인합니다.'],
 ['실제 기록 재생','서버가 남긴 이벤트를 읽기 쉬운 속도로 다시 보여 주는 기능입니다. 새로운 제출이나 서버 처리 대기가 아닙니다.'],
 ['요청값 (nonce)','각 요청을 구분하고 제출 결과를 그 요청에 연결하는 값입니다. 같은 자격을 쓰더라도 기관별 요청값은 다릅니다.'],
 ['취소와 만료','취소는 유효기간 전이라도 사용을 중단하는 것이고, 만료는 정해진 유효기간이 지난 것입니다.'],
 ['영지식 증명 (ZK)','비밀 입력을 드러내지 않고 조건을 증명하는 기술입니다. 현재 기본 공개 체험의 서버 서명 검증과 구분됩니다.'],
];

export default function UserGuide(){
 const [query,setQuery]=useState('');
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const topics=guideTopics.filter(topic=>terms.every(term=>[topic.title,topic.group,topic.roles,topic.intro,topic.prepare,...topic.steps,topic.result,topic.tip].join(' ').toLocaleLowerCase().includes(term)));
 return <div className="user-guide">
  <section className="guide-hero">
   <span className="guide-eyebrow"><BookOpen size={16}/> BIZPROOF USER GUIDE</span>
   <h2>대상을 고르고, 확인한 뒤 제출하세요.</h2>
   <p>공개 체험에는 기업과 자격이 준비되어 있습니다. 직접 결정할 것은 신청 대상과 공유 동의입니다. 나머지 처리 과정은 결과와 실행 기록으로 확인하세요.</p>
   <p className="guide-updated">최근 업데이트 <time dateTime={guideUpdatedAt}>{guideUpdatedAt.replaceAll('-','. ')}</time> · 현재 공개 체험 기준</p>
   <div className="guide-actions"><a href="/welcome">체험 시작하기 <ArrowUpRight size={16}/></a><a href="#guide-public-demo" onClick={()=>setQuery('')}>3단계 따라 하기 ↓</a><a href="#guide-process" onClick={()=>setQuery('')}>처리 애니메이션 사용법 ↓</a></div>
  </section>

  <section className="guide-quickstart" id="guide-public-demo" aria-labelledby="guide-quickstart-title">
   <span className="guide-eyebrow">처음 방문했다면 여기부터</span>
   <h2 id="guide-quickstart-title">처음 신청은 세 단계면 됩니다</h2>
   <p><a href="/welcome">접속 페이지</a>에서 <strong>내 체험 공간 시작하기</strong>를 누르세요. 한빛테크의 가상 기업 정보와 서명 자격이 자동 연결됩니다. 서류·지갑을 준비하거나 역할을 바꾸지 않아도 됩니다.</p>
   <ol className="guide-essential-steps">
    <li><strong>1. 신청 대상 선택</strong><p>구매사 등록 또는 지원사업을 선택하세요. <b>모두 선택</b>으로 두 기관을 함께 고를 수 있습니다.</p></li>
    <li><strong>2. 공유 내용 확인·동의</strong><p>받는 기관, 조건별 결과, 공유하는 정보와 전달하지 않는 원본을 읽고 동의 항목을 체크하세요. 같은 자격이 자동 연결됩니다.</p></li>
    <li><strong>3. 한 번 제출</strong><p><b>선택한 2곳에 제출</b>을 누르세요. 선택한 수에 따라 버튼 이름이 바뀝니다. 준비된 두 기관의 서명·조건 검증과 저장이 자동으로 이어집니다.</p></li>
   </ol>
   <div className="guide-demo-facts" aria-label="준비된 시연 데이터">
    <p><strong>사용할 자격 1개</strong><span>한빛테크 (가상) · 연 매출 3억 원 · 서울 · 준비 시점 약 24개월 업력 · 인증 보유</span></p>
    <p><strong>구매사 등록 조건</strong><span>미래산업 구매팀 (가상) · 매출 2억 원 이상</span></p>
    <p><strong>지원사업 신청 조건</strong><span>서울창업지원센터 (가상) · 매출 5억 원 이하 · 업력 36개월 이내 · 서울</span></p>
   </div>
   <p><strong>제출 후에는</strong> 자동으로 열린 관제 창에서 서버 결과를 확인하고, 신청 결과 또는 <b>진행 현황</b>에서 두 기관의 결과를 확인하세요. 관제 창을 닫아도 제출은 계속됩니다.</p>
   <p className="guide-replay-note"><strong>완료 후에도 움직이고 있나요?</strong> <b>실제 기록 재생</b>은 이미 끝난 작업을 순서대로 보여 주는 기능입니다. 접수는 상단 서버 결과를 기준으로 확인하세요. <b>실제 결과 보기</b>로 바로 돌아갈 수 있고, 재생해도 중복 제출되지 않습니다.</p>
   <details className="guide-extra-help"><summary>추가로 살펴보고 싶다면</summary><p><a href="#guide-credentials" onClick={()=>setQuery('')}>보유 자격 검사</a>, <a href="#guide-process" onClick={()=>setQuery('')}>처리 기록·애니메이션</a>, <a href="#guide-journey" onClick={()=>setQuery('')}>미충족·취소 사례</a>를 읽어 보세요. 기본 신청의 필수 절차는 아닙니다. 상세 메뉴는 <b>상세 기능 더 보기</b>를 누르면 열립니다.</p></details>
   <details className="guide-extra-help"><summary>신청이 진행되지 않거나 다시 접속했다면</summary><p>대상을 선택하고 자격 자동 확인을 기다린 뒤 공유 동의를 체크하세요. 일부만 실패하면 성공한 결과를 확인하고 실패한 기관만 다시 검토합니다. 제출 직후 연결이 끊겼다면 <b>진행 현황</b>을 먼저 확인하세요. 공개 체험 세션은 2시간이며, 만료되면 접속 페이지에서 다시 시작합니다. 공간이 가득 찼다는 안내는 잠시 후 재시도하세요. 공개 체험에서는 실제 문서를 업로드하지 않습니다.</p></details>
  </section>

  <section className="guide-paths" aria-label="목적별 안내">{paths.map(([role,path,id])=><a href={'#guide-'+id} key={role} onClick={()=>setQuery('')}><strong>{role}</strong><span>{path}</span></a>)}</section>
  <p className="guide-boundary"><strong>안내를 읽는 기준</strong> 기본 공개 체험은 가상 데이터와 서버 전자서명을 사용합니다. 아래 발급·정책·외부 연결 안내는 권한과 별도 설정이 필요한 상세 업무입니다. 업무 관리자 역할과 <a href="#guide-analytics" onClick={()=>setQuery('')}>별도 서비스 관리자</a>를 구분하세요. 조건 검증은 기관의 최종 선정·계약 승인이나 실제 블록체인 거래 완료를 뜻하지 않습니다.</p>
  <label className="guide-search"><Search size={20}/><span className="sr-only">이용자 가이드 검색</span><input type="search" placeholder="궁금한 기능을 검색하세요. 예: 애니메이션, 비밀번호, 방문, 제출" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery('')} type="button">초기화</button>}</label>
  <p className="guide-count" role="status">전체 {guideTopics.length}개 안내 중 {topics.length}개 표시</p>
  <div className="guide-layout">
   <nav className="guide-toc" aria-label="이용자 가이드 목차"><b>기능별 이용 안내</b>{[...new Set(topics.map(t=>t.group))].map(group=><div key={group}><small>{group}</small>{topics.filter(t=>t.group===group).map(t=><a key={t.id} href={'#guide-'+t.id}>{t.title}</a>)}</div>)}<a href="#guide-faq">자주 묻는 질문</a><a href="#guide-glossary">용어 쉽게 이해하기</a></nav>
   <div className="guide-articles">
    {topics.length===0&&<section className="guide-empty"><h2>검색 결과가 없습니다.</h2><p>더 짧은 단어나 메뉴 이름으로 검색해 보세요.</p><button onClick={()=>setQuery('')}>모든 안내 보기</button></section>}
    {topics.map(topic=><article id={'guide-'+topic.id} className="guide-topic" key={topic.id}><div className="guide-topic-meta"><span>{topic.group}</span><span>{topic.roles}</span></div><h2>{topic.title}</h2><p>{topic.intro}</p><div className="guide-prepare"><strong>시작 전에</strong><p>{topic.prepare}</p></div><h3>이렇게 사용하세요</h3><ol>{topic.steps.map((step,index)=><li key={step}><span aria-hidden="true">{index+1}</span><p>{step}</p></li>)}</ol><div className="guide-result"><strong>완료 후 확인</strong><p>{topic.result}</p></div><p className="guide-tip"><strong>알아두세요</strong>{topic.tip}</p><a className="guide-open" href={topic.href}>이 기능 열기 <ArrowUpRight size={16}/><span className="sr-only"> · {topic.title}</span></a><a className="guide-back" href="#guide-top">맨 위로 ↑</a></article>)}
    <section className="guide-topic" id="guide-faq"><h2>자주 묻는 질문</h2>{guideFaq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    <section className="guide-topic" id="guide-glossary"><h2>용어 쉽게 이해하기</h2><dl>{glossary.map(([term,meaning])=><div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl></section>
   </div>
  </div>
 </div>;
}

