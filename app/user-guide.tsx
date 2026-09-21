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
  <section className="guide-hero"><span className="guide-eyebrow"><BookOpen size={16}/> BIZPROOF USER GUIDE</span><h2>처음부터, 한 단계씩 함께해요.</h2><p>기업을 등록하고 자격을 발급받은 다음, 같은 자격으로 구매사와 지원사업의 조건을 각각 증명해 보세요.</p><div className="guide-actions"><a href="/?view=apply">간편 신청 시작 <ArrowUpRight size={16}/></a><a href="#guide-start" onClick={()=>setQuery('')}>기본 사용법 읽기 ↓</a></div></section>
  <section className="guide-paths" aria-label="역할별 시작 순서">{[
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
