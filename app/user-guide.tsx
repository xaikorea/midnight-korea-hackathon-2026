/* eslint-disable @next/next/no-html-link-for-pages -- Full navigation synchronizes the custom workspace location store. */
"use client";
import {useState} from 'react';
import {ArrowUpRight,BookOpen,Search} from 'lucide-react';
import {guideTopics,guideFaq} from '@/lib/user-guide';

export default function UserGuide(){
 const [query,setQuery]=useState('');
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const topics=guideTopics.filter(topic=>terms.every(term=>[topic.title,topic.group,topic.roles,topic.intro,topic.prepare,...topic.steps,topic.result,topic.tip].join(' ').toLocaleLowerCase().includes(term)));
 return <div className="user-guide">
  <section className="guide-hero"><span className="guide-eyebrow"><BookOpen size={16}/> BIZPROOF USER GUIDE</span><h2>대상을 고르고, 확인한 뒤 제출하세요.</h2><p>공개 체험에서는 기업과 자격이 미리 준비되어 있습니다. 신청할 기관을 선택하고 공유 내용을 확인하면 결과 검증까지 자동으로 이어집니다.</p><div className="guide-actions"><a href="/?view=apply">간편 신청 시작 <ArrowUpRight size={16}/></a><a href="#guide-start" onClick={()=>setQuery('')}>기본 사용법 읽기 ↓</a></div></section>
  <section className="guide-quickstart" id="guide-public-demo"><span className="guide-eyebrow">처음 방문했다면 여기부터</span><h2>5분 만에 따라 하는 공개 시연</h2><p>서류나 지갑을 준비하지 않아도 됩니다. <a href="/welcome">접속 페이지</a>에서 <strong>내 체험 공간 시작하기</strong>를 누르세요. 각 방문자의 데이터는 별도 공간에 저장됩니다.</p><ol><li><strong>준비된 데이터 확인:</strong> ‘내 체험 공간 시작하기’를 누르면 미리 저장된 한빛테크 기업 정보와 서명 자격이 연결됩니다. 기업 등록이나 새 시연 준비를 따로 누를 필요가 없습니다.</li><li><strong>신청 대상 선택:</strong> 구매사와 지원사업 중 원하는 대상을 누르세요. ‘모두 선택’을 누르면 두 곳을 함께 선택할 수 있습니다.</li><li><strong>공유 확인:</strong> 기관별 조건, 받는 기관, 전달할 정보와 제외할 정보를 읽으세요. 같은 기업 자격이 자동으로 연결됩니다. 선택한 기관에 공유·제출한다는 동의 항목을 체크합니다.</li><li><strong>한 번 제출:</strong> ‘선택한 2곳에 제출’을 누르세요. 기관별 요청과 서명·조건 검증은 내부에서 처리하며, 별도의 ‘기관에서 결과 확인’ 버튼은 필요 없습니다.</li><li><strong>결과와 이어하기:</strong> 같은 화면과 ‘진행 현황’에서 기관별 결과를 확인하세요. 새로고침해도 같은 세션의 데이터와 결과는 유지됩니다. 일부 실패 시 완료된 기관은 제외하고 실패한 기관만 다시 확인합니다.</li></ol><p><strong>무엇을 직접 결정하나요?</strong> 신청 대상과 공유 동의는 사용자가 결정합니다. 요청 연결·서명 확인 등은 시스템에서 처리합니다. 기본 시연은 서버 서명 방식이며 실제 Midnight 네트워크 거래는 발생하지 않습니다.</p><p><strong>진행이 안 되나요?</strong> 제출 버튼이 비활성화되면 공유 동의 체크를 확인하세요. 세션이 만료되면 접속 페이지에서 다시 시작하세요. 체험 공간이 가득 찼다는 안내가 나오면 잠시 후 재시도하세요. 공개 모드에서는 실제 문서 업로드를 지원하지 않습니다.</p><p><strong>메뉴가 다르게 보이나요?</strong> 선택한 업무 역할에 따라 메뉴가 달라집니다. 상세 기능은 ‘상세 기능 더 보기’을 켜거나 허용된 역할로 전환하여 확인하세요. 워크스페이스 관리자는 가상 업무 역할이며, 방문 분석에 접속하는 별도 서비스 관리자와 다릅니다.</p><a href="/welcome">체험 시작 화면으로 →</a></section><section className="guide-paths" aria-label="역할별 시작 순서">{[
   ['기업 담당자','신청 대상 선택 → 공유 내용 확인·제출 → 진행 현황','apply'],
   ['발급기관','검토 대기 → 증빙·속성 검토 → 서명 발급','progress'],
   ['구매사·지원기관','검증 정책 → 검증 요청 → 제출 결과 확인','policies'],
   ['관리자','신뢰 발급기관·접근 권한 → 연결 상태 → 활동·방문 분석','settings'],
  ].map(([role,path,id])=><a href={'#guide-'+id} key={role} onClick={()=>setQuery('')}><strong>{role}</strong><span>{path}</span></a>)}</section>
  <p className="guide-boundary"><strong>체험 전에 알아두세요.</strong> 현재 기본 업무는 가상 데이터와 서버 전자서명 기반 데모입니다. 공식 기관 인증이나 실제 블록체인 거래 완료를 의미하지 않습니다. 외부 서비스는 연결 상태를 따로 확인하세요.</p>
  <label className="guide-search"><Search size={20}/><span className="sr-only">이용자 가이드 검색</span><input type="search" placeholder="궁금한 기능을 검색하세요. 예: 증빙, 제출, 방문, Midnight" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery('')} type="button">초기화</button>}</label>
  <p className="guide-count" role="status">전체 {guideTopics.length}개 안내 중 {topics.length}개 표시</p>
  <div className="guide-layout"><nav className="guide-toc" aria-label="이용자 가이드 목차"><b>기능별 이용 안내</b>{[...new Set(topics.map(t=>t.group))].map(group=><div key={group}><small>{group}</small>{topics.filter(t=>t.group===group).map(t=><a key={t.id} href={'#guide-'+t.id}>{t.title}</a>)}</div>)}<a href="#guide-faq">자주 묻는 질문</a><a href="#guide-glossary">용어 쉽게 이해하기</a></nav>
   <div className="guide-articles">{topics.length===0&&<section className="guide-empty"><h2>검색 결과가 없습니다.</h2><p>더 짧은 단어나 메뉴 이름으로 검색해 보세요.</p><button onClick={()=>setQuery('')}>모든 안내 보기</button></section>}{topics.map(topic=><article id={'guide-'+topic.id} className="guide-topic" key={topic.id}><div className="guide-topic-meta"><span>{topic.group}</span><span>{topic.roles}</span></div><h2>{topic.title}</h2><p>{topic.intro}</p><div className="guide-prepare"><strong>시작 전에</strong><p>{topic.prepare}</p></div><h3>이렇게 사용하세요</h3><ol>{topic.steps.map((step,index)=><li key={step}><span aria-hidden="true">{index+1}</span><p>{step}</p></li>)}</ol><div className="guide-result"><strong>완료 후 확인</strong><p>{topic.result}</p></div><p className="guide-tip"><strong>알아두세요</strong>{topic.tip}</p><a className="guide-open" href={topic.href}>이 기능 열기 <ArrowUpRight size={16}/><span className="sr-only"> · {topic.title}</span></a><a className="guide-back" href="#guide-top">맨 위로 ↑</a></article>)}
   <section className="guide-topic" id="guide-faq"><h2>자주 묻는 질문</h2>{guideFaq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
   <section className="guide-topic" id="guide-glossary"><h2>용어 쉽게 이해하기</h2><dl>{[['자격 (Credential)','발급기관이 기업의 속성에 서명한 전자 증명서입니다.'],['정책 (Policy)','기관이 확인하고 싶은 조건의 묶음입니다. 예를 들어 매출 2억 원 이상입니다.'],['제출 결과 (Presentation)','특정 요청과 수신 기관을 위해 만든 조건 확인 결과입니다. 자격 원본과 다릅니다.'],['발급기관 (Issuer)','기업 정보를 검토하고 자격에 서명하는 주체입니다.'],['업무 권한','담당자가 해당 기업을 위해 어떤 일을 할 수 있는지 나타내는 증명입니다.'],['취소와 만료','취소는 유효기간 전이라도 사용을 중단하는 것이고, 만료는 정해진 유효기간이 지난 것입니다.'],['영지식 증명 (ZK)','비밀 입력을 드러내지 않고 조건을 증명하는 기술입니다. 이 플랫폼의 기본 서명 기반 웹 데모와 구분됩니다.']].map(([term,meaning])=><div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl></section></div>
  </div>
 </div>;
}
