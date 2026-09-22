export const processStages = {
  access: '접근 권한·동의 확인', credential: '기업 자격 검사', consent: '공유 내용 대조',
  request: '기관별 요청 연결', policy: '신청 조건 판정', signature: '제출 결과 서명',
  verification: '수신 기관 검증', audit: '접수·감사 기록 구성', commit: '데이터베이스 저장',
} as const;
export type ProcessStage = keyof typeof processStages;
export type ProcessEventState = 'running'|'success'|'failed'|'skipped'|'waiting';
export type ProcessData = {
  credentialId?:string; issuerId?:string; schemaId?:string; keyId?:string; authorityId?:string;
  requestId?:string; presentationId?:string; policyHash?:string; credentialDigest?:string;
  nonce?:string; previewHash?:string; algorithm?:string; engine?:string; eligible?:boolean;
  replayed?:boolean; operational?:boolean; candidateCount?:number; savedVersion?:number;
  checks?:{label:string;pass:boolean}[];
};
export type ProcessEvent = {seq:number;policyId?:string;stage:ProcessStage;state:ProcessEventState;at:string;elapsedMs:number;durationMs?:number;message:string;data:ProcessData};
export type ProcessRun = {
  id:string;companyId:string;companyName:string;startedAt:string;updatedAt:string;completedAt?:string;
  status:'running'|'succeeded'|'partial'|'failed';committed:boolean;historySaved:boolean;
  policies:{id:string;audience:string}[];events:ProcessEvent[];
  engine:{signature:'Ed25519';policy:string;networkConnected:false};
};
export type ProcessObserver = (stage:ProcessStage,state:ProcessEventState,message:string,data?:ProcessData)=>Promise<void>;

// The monitor is not a dump of requests, credentials or runtime configuration.
// Only these explicit fields may cross the observation boundary.
export function safeProcessData(value:ProcessData):ProcessData {
  const safe:ProcessData={};
  const strings=['credentialId','issuerId','schemaId','keyId','authorityId','requestId','presentationId','policyHash','credentialDigest','nonce','previewHash','algorithm','engine'] as const;
  for(const key of strings)if(typeof value[key]==='string')safe[key]=value[key]!.slice(0,180);
  for(const key of ['eligible','replayed','operational'] as const)if(typeof value[key]==='boolean')safe[key]=value[key];
  for(const key of ['candidateCount','savedVersion'] as const)if(typeof value[key]==='number'&&Number.isFinite(value[key]))safe[key]=value[key];
  if(Array.isArray(value.checks))safe.checks=value.checks.slice(0,20).map(c=>({label:String(c.label).slice(0,180),pass:c.pass===true}));
  return safe;
}
