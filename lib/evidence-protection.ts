import {protectionMode,storageClient} from './storage-protection';
import {envelopeSchema} from './openbao';
import {z} from 'zod';
const chunkSize=256*1024,maxSize=2*1024*1024;
const fileEnvelope=z.object({format:z.literal('bizproof-evidence-openbao-v1'),size:z.number().int().positive().max(maxSize),sha256:z.string().regex(/^[a-f0-9]{64}$/),chunks:z.array(envelopeSchema).min(1).max(8)}).strict();
export async function evidenceHash(bytes:ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function base64(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
export async function protectEvidence(owner:string,key:string,bytes:ArrayBuffer){
 if(!bytes.byteLength||bytes.byteLength>maxSize)throw Error('증빙 크기를 확인하세요.');
 if(protectionMode()!=='openbao')return {body:bytes,encrypted:false};
 const sha256=await evidenceHash(bytes),chunks=[],client=storageClient();
 for(let at=0;at<bytes.byteLength;at+=chunkSize)chunks.push(await client.encrypt(JSON.stringify([owner,key,bytes.byteLength,sha256,at/chunkSize]),base64(new Uint8Array(bytes.slice(at,at+chunkSize)))));
 return {body:JSON.stringify({format:'bizproof-evidence-openbao-v1',size:bytes.byteLength,sha256,chunks}),encrypted:true};
}
export async function readEvidence(owner:string,key:string,object:{arrayBuffer:()=>Promise<ArrayBuffer>;customMetadata?:Record<string,string>},expectedHash?:string){
 let bytes=await object.arrayBuffer();
 if(object.customMetadata?.protection==='openbao-v1'){
  if(protectionMode()!=='openbao')throw Error('암호화된 증빙에는 OpenBao 연결이 필요합니다.');
  if(bytes.byteLength>5*1024*1024)throw Error('증빙 암호문 크기가 잘못되었습니다.');
  const envelope=fileEnvelope.parse(JSON.parse(new TextDecoder().decode(bytes)));if(envelope.chunks.length!==Math.ceil(envelope.size/chunkSize))throw Error('증빙 조각이 누락되었습니다.');
  const result=new Uint8Array(envelope.size),client=storageClient();let offset=0;
  for(const [index,chunk] of envelope.chunks.entries()){const plain=Uint8Array.from(atob(await client.decrypt(JSON.stringify([owner,key,envelope.size,envelope.sha256,index]),chunk)),c=>c.charCodeAt(0));if(plain.length!==Math.min(chunkSize,envelope.size-offset))throw Error('증빙 조각 크기가 다릅니다.');result.set(plain,offset);offset+=plain.length;}bytes=result.buffer;if(await evidenceHash(bytes)!==envelope.sha256)throw Error('증빙 무결성 검증 실패');
 }
 if(bytes.byteLength>maxSize||expectedHash&&await evidenceHash(bytes)!==expectedHash)throw Error('증빙 무결성 검증 실패');return bytes;
}
