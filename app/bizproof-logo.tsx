export default function BizProofLogo({animated=false,compact=false}:{animated?:boolean;compact?:boolean}){
 return <span className={`bp-logo ${animated?'bp-logo-animated':''}`} aria-label="BizProof">
  <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="7" y="7" width="10" height="50" rx="5" fill="#142E52"/><path className="bp-logo-upper" d="M26 12H35C54 12 54 32 35 32H26" stroke="#3457EE" strokeWidth="9" strokeLinecap="round"/><path className="bp-logo-lower" d="M26 32H37C56 32 56 52 37 52H26" stroke="#119D9A" strokeWidth="9" strokeLinecap="round"/></svg>
  {!compact&&<span className="bp-logo-word">Biz<span>Proof</span></span>}
 </span>;
}
