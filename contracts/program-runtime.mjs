// Schnorr signing pattern adapted from midnightntwrk/example-zkloan (Apache-2.0).
import { randomBytes } from 'node:crypto';
import { createConstructorContext,createCircuitContext,sampleContractAddress,ecMulGenerator } from '@midnight-ntwrk/compact-runtime';
import {Contract,ledger,pureCircuits} from './managed-program/contract/index.js';
const ORDER=6554484396890773809930967563523245729705921265872317281365359162392183254199n;
const TWO248=1n<<248n;
export const randomId=()=>new Uint8Array(randomBytes(32));
const scalar=()=>BigInt('0x'+randomBytes(32).toString('hex'))%(ORDER-1n)+1n;
export function signClaims(sk,claims,holder){const pk=ecMulGenerator(sk),k=scalar(),R=ecMulGenerator(k);const message=pureCircuits.credentialMessage(claims,holder);const c=pureCircuits.signingChallenge(R.x,R.y,pk.x,pk.y,message)%TWO248;return {announcement:R,response:(k+c*sk)%ORDER};}
export const witnesses={secret:({privateState:s})=>[s,s.secret],attestation:({privateState:s})=>[s,[s.claims,s.signature]],getSchnorrReduction:({privateState:s},c)=>[s,[c/TWO248,c%TWO248]]};
export class Simulator {
 constructor(){this.adminSecret=randomId();this.holderSecret=randomId();this.providerSecret=scalar();this.now=BigInt(Math.floor(Date.now()/1000));this.contract=new Contract(witnesses);const init=this.contract.initialState(createConstructorContext({secret:this.adminSecret},'0'.repeat(64)),this.now);this.context=createCircuitContext(sampleContractAddress(),init.currentZswapLocalState,init.currentContractState,init.currentPrivateState);this.invoke('registerIssuer',[1n,ecMulGenerator(this.providerSecret)],this.adminSecret);this.holder=pureCircuits.holderKey(this.holderSecret);this.claims={revenue:300000000n,foundedDay:BigInt(Math.floor(Date.now()/864e5)-730),fiscalYear:2025n,investment:3400000000n,plannedResidents:17n,companyCommitment:randomId(),bundleDigest:randomId(),issuedAt:this.now-3600n,expiresAt:this.now+15552000n,credentialId:randomId()};this.signature=signClaims(this.providerSecret,this.claims,this.holder);}
 invoke(name,args=[],secret=this.adminSecret,claims=this.claims,signature=this.signature){const input={...this.context,currentPrivateState:{secret,claims,signature}};const out=this.contract.circuits[name](input,...args);this.context=out.context;return out.result;}
 get state(){return ledger(this.context.currentQueryContext.state);}
 request(policy={}){const id=randomId();const p={minRevenue:2000000000n,minInvestment:3000000000n,fiscalYear:2025n,requireFinance:true,minResidents:15n,minFoundedDay:0n,maxFoundedDay:BigInt(Math.floor(Date.now()/864e5)),issuerId:1n,...policy};const request={holder:this.holder,audience:randomId(),nonce:randomId(),companyCommitment:this.claims.companyCommitment,profileDigest:randomId(),policy:p,deadline:this.now+86400n};this.invoke('createRequest',[id,request]);return id;}
 submit(id,claims=this.claims,signature=this.signature,secret=this.holderSecret){this.invoke('submit',[id],secret,claims,signature);return this.state.results.lookup(id);}
}
