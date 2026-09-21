import {z} from 'zod';

export const vleiSourceCommit='5850051b52dce24ed59eae486af76e7c73f6012c';
export function validLei(value:string){if(!/^[A-Z0-9]{18}[0-9]{2}$/.test(value))return false;let mod=0;for(const char of value){const digits=/\d/.test(char)?char:String(char.charCodeAt(0)-55);for(const digit of digits)mod=(mod*10+Number(digit))%97;}return mod===1;}
const qb64=z.string().regex(/^[A-Za-z0-9_-]{44}$/,'44자리 AID/SAID를 확인하세요.');
export const vleiExpectedSchema=z.object({aid:qb64,said:qb64,lei:z.string().refine(validLei,'LEI 길이·체크섬을 확인하세요.'),role:z.string().trim().min(1).max(100)}).strict();
const header=z.string().min(1).max(4096).refine(v=>!/[\r\n]/.test(v));
export const vleiHeadersSchema=z.object({'signature-input':header,signature:header,'signify-resource':qb64,'signify-timestamp':header}).strict();
export const vleiRequestSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('present'),expected:vleiExpectedSchema,cesr:z.string().min(1).max(250000),consent:z.literal(true)}).strict(),
 z.object({action:z.literal('status'),expected:vleiExpectedSchema}).strict(),
 z.object({action:z.literal('authorize'),expected:vleiExpectedSchema,headers:vleiHeadersSchema}).strict()
]);
export type VleiExpected=z.infer<typeof vleiExpectedSchema>;
export class VleiError extends Error {}
export function checkSignedQuery(expected:VleiExpected,headers:z.infer<typeof vleiHeadersSchema>,now=Date.now()){
 if(headers['signify-resource']!==expected.aid)throw new VleiError('서명한 AID와 조회 대상이 다릅니다.');
 const timestamp=Date.parse(headers['signify-timestamp']);
 const input=headers['signature-input'];
 const fields=/^signify=\(((?:"[^"\r\n]+"\s*)+)\)/.exec(input);
 const created=[...input.matchAll(/;created=(\d+)(?=;|$)/g)];
 const expires=[...input.matchAll(/;expires=(\d+)(?=;|$)/g)];
 const covered=fields?.[1].match(/"[^"]+"/g)?.map(v=>v.slice(1,-1))??[];
 if(!fields||['@method','@path','signify-resource','signify-timestamp'].some(f=>!covered.includes(f))||new Set(covered).size!==covered.length||created.length!==1||expires.length>1||input.includes(','))throw new VleiError('Signify 서명에 요청 메서드·경로·AID·시각과 created를 포함하세요.');
 const issued=Number(created[0][1])*1000,end=expires.length?Number(expires[0][1])*1000:null;
 if(!Number.isFinite(timestamp)||!Number.isSafeInteger(issued)||Math.abs(timestamp-issued)>60000||issued<now-300000||issued>now+60000||(end!==null&&(!Number.isSafeInteger(end)||end<=now||end<=issued)))throw new VleiError('서명 헤더가 만료되었거나 시각이 맞지 않습니다. 새 조회 서명을 만드세요.');
}
const boundary={officialVleiVerified:false as const,rootOfTrustObserved:false as const,revocationConfigurationObserved:false as const,adapterSourceCommit:vleiSourceCommit};
export function vleiClient(fetcher:typeof fetch=fetch){
 // The browser cannot choose the service URL, roots, OOBIs, witness URLs or runtime security settings.
 const base='http://127.0.0.1:7676';
 async function request(path:string,init:RequestInit={}){
  let response:Response;try{response=await fetcher(base+path,{...init,redirect:'manual',signal:AbortSignal.timeout(10000)});}catch{throw new VleiError('로컬 vLEI 검증기에 연결하지 못했습니다.');}
  if(response.status>=300&&response.status<400)throw new VleiError('검증기 리디렉션은 허용하지 않습니다.');
  const reader=response.body?.getReader();let size=0,text='';const decoder=new TextDecoder();
  if(reader){try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>32768){await reader.cancel();throw new VleiError('검증기 응답이 너무 큽니다.');}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}}
  let data:unknown;try{data=text?JSON.parse(text):{};}catch{throw new VleiError('검증기 응답 형식을 확인할 수 없습니다.');}
  return {status:response.status,data};
 }
 return {
  async status(expected:VleiExpected){
   vleiExpectedSchema.parse(expected);const result=await request('/presentations/'+expected.said);
   if(![202,205,400,404].includes(result.status))throw new VleiError('제출 처리 상태를 확인하지 못했습니다.');
   return {...boundary,status:result.status===202?'processing' as const:result.status===205?'aged-off' as const:'not-found' as const,authorizationMatched:false,expected,checkedAt:new Date().toISOString(),notice:result.status===202?'검증기에 제출 처리 기록이 있습니다. 이 응답은 자격 승인·취소 검사 완료를 뜻하지 않습니다. 새 서명으로 권한 조회를 실행하세요.':result.status===205?'검증기의 제출 처리 보관 시간이 지났습니다. 자격 자체가 취소되었다는 의미는 아닙니다.':'제출 처리 기록을 찾지 못했습니다. 원문 자격의 유효성 판정이 아닙니다.'};
  },
  async readiness(){const [health,status]=await Promise.allSettled([request('/health'),request('/service_status')]);const reachable=health.status==='fulfilled'&&health.value.status===200&&status.status==='fulfilled'&&status.value.status===200&&z.object({status:z.literal('OK'),mode:z.literal('verifier')}).safeParse(status.value.data).success;return {...boundary,reachable,checkedAt:new Date().toISOString(),notice:'서비스 응답 검사입니다. 운영 모드·신뢰 루트·취소 검사 설정 또는 특정 vLEI의 유효성을 증명하지 않습니다.'};},
  async present(expected:VleiExpected,cesr:string){
   vleiExpectedSchema.parse(expected);if(new TextEncoder().encode(cesr).length>250000||!cesr.trim())throw new VleiError('CESR 파일은 비어 있지 않은 250KB 이하 데이터여야 합니다.');
   const result=await request('/presentations/'+expected.said,{method:'PUT',headers:{'content-type':'application/json+cesr'},body:cesr});
   if(result.status!==202)throw new VleiError(result.status===503?'검증기가 사용 중입니다. 제출 상태를 확인한 뒤 다시 시도하세요.':'검증기가 제출을 수락하지 않았습니다. CESR와 자격 식별자를 확인하세요.');
   const accepted=z.object({aid:qb64.optional(),said:qb64.optional()}).safeParse(result.data);
   if(!accepted.success||(accepted.data.aid&&accepted.data.aid!==expected.aid)||(accepted.data.said&&accepted.data.said!==expected.said))throw new VleiError('수락 응답의 AID·SAID가 제출 대상과 다릅니다.');
   return {...boundary,status:'accepted' as const,authorizationMatched:false,expected,checkedAt:new Date().toISOString(),notice:'제출을 수락했습니다. 202 응답은 자격 검증·업무 권한 승인 완료가 아닙니다.'};
  },
  async authorize(expected:VleiExpected,rawHeaders:z.infer<typeof vleiHeadersSchema>){
   vleiExpectedSchema.parse(expected);const headers=vleiHeadersSchema.parse(rawHeaders);
   checkSignedQuery(expected,headers);
   const result=await request('/authorizations/'+expected.aid,{headers});
   const common={...boundary,authorizationMatched:false,checkedAt:new Date().toISOString(),expected};
   if(result.status!==200){if([400,401,403,404].includes(result.status))return {...common,status:result.status===404?'not-found' as const:'not-authorized' as const,checks:[],notice:'권한을 확인하지 못했습니다. 미처리·자격 거절·요청 서명 실패를 이 응답만으로 구분하지 않습니다. 새 서명 헤더로 다시 조회하세요.'};throw new VleiError('검증기 조회에 실패했습니다.');}
   const response=z.object({aid:qb64,said:qb64,lei:z.string().nullable(),role:z.string().nullable()}).safeParse(result.data);
   if(!response.success)throw new VleiError('권한 응답에 필요한 자격 정보가 없습니다.');
   const actual=response.data,checks=[{label:'담당자 AID',pass:actual.aid===expected.aid},{label:'제출 자격 SAID',pass:actual.said===expected.said&&actual.said!==actual.aid},{label:'기업 LEI',pass:actual.lei===expected.lei&&validLei(actual.lei??'')},{label:'업무 역할',pass:actual.role===expected.role}];
   const match=checks.every(c=>c.pass);
   return {...common,status:match?'matched' as const:'mismatch' as const,authorizationMatched:match,checks,notice:'외부 검증기의 현재 응답과 입력한 대조 기준의 일치 여부입니다. AID 로그인만으로 자격을 승인하지 않습니다. GLEIF 신뢰 루트·취소 검사 설정은 별도로 확인해야 하며 BizProof 업무 권한을 자동 부여하지 않습니다.'};
  }
 };
}
