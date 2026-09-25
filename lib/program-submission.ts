import {findProgram,programWindow} from './program-catalog';
// Fixed, reviewed public destinations only. No applicant data or tokens in outbound URLs.
const destinations:Record<string,{url:string;label:string;steps:string[]}>= {
 'seongsu-2026-h2':{url:'https://www.startup-plus.kr/project/PRJ007420',label:'스타트업플러스 성수 공고',steps:['공고의 접수 기간과 최신 첨부서식을 확인합니다.','스타트업플러스에 로그인한 뒤 공고의 신청 버튼을 누릅니다.','공식 서식과 원본 자료를 제출하고 기관 사이트에서 접수번호를 확인합니다.']},
 'ai-hub-2026-leading':{url:'https://www.startup-plus.kr/project/PRJ006524',label:'서울 AI 허브 원문 · 종료된 회차',steps:['이 회차는 종료되어 현재 접수할 수 없습니다.','최신 모집 공고의 유형과 조건을 확인한 뒤 새 프로필로 준비해야 합니다.']},
 'gongdeok-2026-h1':{url:'https://hubgongdeok.startup-plus.kr/project/PRJ006640',label:'공덕 원문 · 종료된 회차',steps:['이 회차는 종료되어 현재 접수할 수 없습니다.','다음 회차의 기준일과 지정서식을 다시 확인해야 합니다.']},
 'hyundai-steel-technical':{url:'https://tech.hyundai-steel.com/ko',label:'현대제철 기술제안 플랫폼',steps:['공식 기술제안 플랫폼의 계정과 제출 규정을 확인합니다.','기업·제안 품목·적용 기술과 원본 제안서를 입력합니다.','구매기획 및 공장 기술 검토 이후 시험·계약 절차를 진행합니다. 기술제안은 공급사 등록 완료와 다릅니다.']},
 'posco-sourcing':{url:'https://my.posco.com/',label:'POSCO 공식 구매 포털',steps:['공식 포털에서 공급사와 소싱그룹별 현행 등록 조건을 확인합니다.','품목별 자료와 신용·재무·윤리 서약을 공식 양식으로 제출합니다.','구매 담당자의 심사 및 접수 결과를 포털에서 확인합니다.']},
 'sk-hynix-supplier':{url:'https://gpis.skhynix.com/',label:'SK하이닉스 GPIS',steps:['신규 협력사 안내에서 품목 분류와 구매·TSC 경로를 확인합니다.','GPIS의 신규 등록 정보와 공식 필수 자료를 입력합니다.','심사 요청 이후 구매·TSC 검토 결과를 GPIS에서 확인합니다.']},
};
export function programSubmission(id:string,now=new Date()){
 const p=findProgram(id),d=destinations[id];if(!p||!d)throw Error('Unknown program');
 const window=programWindow(p,now);return {...d,window,automaticSubmission:false as const,apiStatus:'provider-agreement-required' as const,officialReceipt:null,checkedAt:'2026-09-25',notice:'공식 사이트로 이동할 수 있습니다. BizProof는 기관으로 자료를 자동 전송하거나 접수번호를 발급하지 않습니다. 합성 시연 자료는 실제 기관에 제출하지 마세요.',requirements:['기관이 제공한 공식 API 또는 협약 연동 규격','해당 기관의 테스트 계정 및 발급자·대표권 확인','접수번호 조회·중복 제출 방지·취소 및 상태 회신 규격']};
}
