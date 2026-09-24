import {type Issuer,type Presentation,presentationPayload} from './domain';
import {sign,verify} from './signatures';

export function platformKey(){
 const raw=process.env.BIZPROOF_PROCESSING_KEY;
 if(!raw)throw Error('플랫폼 처리 결과 서명 키를 설정해야 합니다.');
 const key=JSON.parse(raw) as {keyId:string;publicKey:JsonWebKey;privateKey:JsonWebKey};
 if(!key.keyId||!key.privateKey?.d||key.publicKey?.d||key.publicKey?.crv!=='Ed25519')throw Error('플랫폼 처리 서명 키 설정 오류');
 return key;
}
export async function signProcessingResult(p:Presentation,issuer:Issuer){
 if(issuer.kind==='remote'){
  const key=platformKey();p.proofVersion=3;p.signerKind='platform';p.keyId=key.keyId;
  p.signature=await sign(key.privateKey,presentationPayload(p));
 }else p.signature=await sign(issuer.privateKey,presentationPayload(p));
}
export async function verifyProcessingResult(p:Presentation,issuer:Issuer){
 if(issuer.kind==='remote'){
  const key=platformKey();return p.proofVersion===3&&p.signerKind==='platform'&&p.keyId===key.keyId&&await verify(key.publicKey,presentationPayload(p),p.signature);
 }
 if(p.proofVersion===3||p.signerKind)return false;
 const key=p.keyId===issuer.keyId?issuer.publicKey:issuer.previousKeys.find(k=>k.keyId===p.keyId)?.publicKey;
 return !!key&&await verify(key,presentationPayload(p),p.signature);
}
