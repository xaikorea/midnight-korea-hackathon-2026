import {validLei} from './vlei-verifier';
export const qviSource='https://www.gleif.org/en/organizational-identity/get-an-lei-vlei/get-a-vlei';
export const qviReviewedOn='2026-09-21';
// Reviewed public directory snapshot; never used as a cryptographic trust registry.
const issuers=[
 {name:'SHECA',lei:'83680008RNIDW9LD8Z21',website:'https://static.sheca.com/vlei-web/',qualifiedOn:'2025-10-15'},
 {name:'TOPPAN Edge Inc.',lei:'353800460NTF5K7NU940',website:'https://www.edge.toppan.com/',qualifiedOn:'2025-09-05'},
 {name:'TradeGo',lei:'984500C2EED6A7382A87',website:'https://tradego.com/',qualifiedOn:'2025-06-25'},
 {name:'Global vLEI',lei:'636700LQ8SMYXSBX5D74',website:'https://globalvlei.com/',qualifiedOn:'2025-05-26'},
 {name:'Certizen',lei:'836800VC81GMPMG59W77',website:'https://www.certlei.com/',qualifiedOn:'2025-03-20'},
 {name:'FINEMA',lei:'894500D5AV38KEBZAS18',website:'https://finema.co/',qualifiedOn:'2025-02-21'},
 {name:'CFCA',lei:'300300CQ1FG1K4KM7075',website:'https://www.cfca.com.cn/',qualifiedOn:'2025-02-14'},
 {name:'Provenant',lei:'984500983AD71E4FBC41',website:'https://provenant.net/',qualifiedOn:'2022-12-08'},
];
export function qviDirectory(query='',sort='newest'){
 if(query.length>100||!['newest','name'].includes(sort))throw new Error('검색 조건을 확인하세요.');
 const items=issuers.filter(i=>(i.name+' '+i.lei).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):b.qualifiedOn.localeCompare(a.qualifiedOn));
 if(items.some(i=>!validLei(i.lei)||new URL(i.website).protocol!=='https:'))throw new Error('발급기관 자료를 확인해야 합니다.');
 return {source:qviSource,reviewedOn:qviReviewedOn,live:false,items,total:issuers.length,notice:'공식 페이지 확인일 기준 목록입니다. 현재 자격 상태와 신청 조건은 GLEIF 및 해당 기관에서 다시 확인하세요.'};
}
export type QviDirectory=ReturnType<typeof qviDirectory>;
