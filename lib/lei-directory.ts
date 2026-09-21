import {z} from 'zod';
import {validLei} from './vlei-verifier';

const text=z.string().max(1000);
const record=z.object({data:z.object({id:z.string(),attributes:z.object({lei:z.string(),entity:z.object({legalName:z.object({name:text}),jurisdiction:text,status:text,legalAddress:z.object({addressLines:z.array(text).max(20),city:text,country:text,postalCode:text})}),registration:z.object({status:text,lastUpdateDate:text,nextRenewalDate:text.nullable()})})})});
export class LeiLookupError extends Error {constructor(message:string,public status:number){super(message);}}
export async function lookupLei(input:string,fetcher:typeof fetch=fetch){
 const lei=input.trim().toUpperCase();
 if(!validLei(lei))throw new LeiLookupError('20자리 LEI와 체크섬을 확인하세요.',400);
 const source='https://api.gleif.org/api/v1/lei-records/'+lei;
 try{
  const response=await fetcher(source,{headers:{Accept:'application/vnd.api+json'},redirect:'error',signal:AbortSignal.timeout(8000)});
  if(response.status===404)throw new LeiLookupError('등록된 LEI를 찾을 수 없습니다.',404);
  if(!response.ok)throw new LeiLookupError('GLEIF 조회 서비스를 이용할 수 없습니다. 잠시 후 다시 시도하세요.',503);
  const reader=response.body?.getReader();if(!reader)throw Error('Empty body');
  let content='',size=0;const decoder=new TextDecoder();
  try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>262144){await reader.cancel();throw Error('Oversized response');}content+=decoder.decode(chunk.value,{stream:true});}content+=decoder.decode();}finally{reader.releaseLock();}
  const parsed=record.parse(JSON.parse(content)).data;
  if(parsed.id!==lei||parsed.attributes.lei!==lei)throw Error('Mismatched LEI');
  const {entity,registration}=parsed.attributes;
  return {lei,legalName:entity.legalName.name,jurisdiction:entity.jurisdiction,entityStatus:entity.status,registrationStatus:registration.status,address:[...entity.legalAddress.addressLines,entity.legalAddress.city,entity.legalAddress.postalCode,entity.legalAddress.country].filter(Boolean).join(', '),lastUpdated:registration.lastUpdateDate,nextRenewal:registration.nextRenewalDate,source,checkedAt:new Date().toISOString(),officialVleiVerified:false as const,notice:'공개 LEI 등록정보 조회 결과입니다. 담당자 신원·대표 권한·vLEI 자격의 유효성을 증명하지 않습니다.'};
 }catch(e){if(e instanceof LeiLookupError)throw e;throw new LeiLookupError('GLEIF 응답을 확인하지 못했습니다. 다시 조회하세요.',503);}
}
export type LeiRecord=Awaited<ReturnType<typeof lookupLei>>;
