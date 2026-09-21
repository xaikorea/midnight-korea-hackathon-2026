export default function BizProofLogo({animated=false,compact=false}:{animated?:boolean;compact?:boolean}){
 return <span className={`bp-logo ${animated?'bp-logo-animated':''}`} aria-label="BizProof">
  <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect className="bp-logo-tile" x="2" y="2" width="60" height="60" rx="19" fill="#284CE8"/><path d="M18 16H32C43 16 48 23 43 31C50 40 43 49 32 49H18V16Z" fill="white" fillOpacity=".16"/><path className="bp-logo-check" d="M18 33L28 43L47 23" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="48" cy="48" r="5" fill="#B8F298"/></svg>
  {!compact&&<span className="bp-logo-word">BizProof<span>.</span></span>}
 </span>;
}
