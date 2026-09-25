import {CompiledContract} from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import {Contract,type BusinessClaims,type Schnorr_SchnorrSignature,type Witnesses} from '../managed-program/contract/index.js';
import {programAssets as assetsDirectory} from './program-public-state.ts';
export type PrivateState={secret:Uint8Array;claims?:BusinessClaims;signature?:Schnorr_SchnorrSignature};
export type BusinessContract=Contract<PrivateState>;
const two248=1n<<248n;
export const witnesses:Witnesses<PrivateState>={
 secret:({privateState:s})=>{if(!(s.secret instanceof Uint8Array)||s.secret.length!==32)throw Error('보유자 또는 관리자 비밀 상태가 필요합니다.');return [s,s.secret];},
 attestation:({privateState:s})=>{if(!s.claims||!s.signature)throw Error('미리 발급한 Schnorr 자격을 비공개 저장소에 등록하세요.');return [s,[s.claims,s.signature]];},
 getSchnorrReduction:({privateState:s},challenge)=>[s,[challenge/two248,challenge%two248]],
};
export const compiledContract=CompiledContract.make<BusinessContract>('BizProofProgram',Contract).pipe(CompiledContract.withWitnesses(witnesses),CompiledContract.withCompiledFileAssets(assetsDirectory));
