export type Outcome='pass'|'fail'|'unknown'|'manual_review'|'not_applicable';
export type Fact='foundedOn'|'registered'|'newIndustry'|'revenueKrw'|'fiscalYear'|'investmentKrw'|'plannedResidents'|'nationalTaxClear'|'localTaxClear'|'noHubHistory'|'noDuplicateSpace'|'womenBusiness';
export type Facts=Partial<Record<Fact,string|number|boolean>>;
export type Rule={id:string;label:string;bonus?:boolean}&(
 |{op:'all';rules:Rule[]}|{op:'any';rules:Rule[]}
 |{op:'compare';fact:Fact;value:string|number|boolean;comparison:'eq'|'gte';fiscalYear?:number}
 |{op:'age';referenceDate:string;months:number;comparison:'lt'|'lte'}
 |{op:'manual';reason:string});
export type DocumentType='registration'|'ir'|'finance'|'investment'|'residents'|'national-tax'|'local-tax'|'insurance'|'application'|'consent'|'women-business'|'technical-proposal'|'credit'|'esg';
export type DocumentRequirement={type:DocumentType;label:string;maxBytes:number;maxPages?:number;bonus?:boolean;alternative?:DocumentType;exception?:string};
export type ProgramProfile={id:string;version:string;name:string;organization:string;kind:'grant'|'buyer';category:string;sourceUrl:string;sourceCheckedAt:string;sourceDigest:null;sourceStatus:'public-reference';window?:{opens:string;closes:string};contact:string;rules:Rule[];documents:DocumentRequirement[];notes:string[];externalSubmission:'not-connected'};
export type ProgramCredential={id:string;schemaVersion:'bizproof:program-facts:1';companyId:string;registration:string;issuerId:string;keyId:string;facts:Facts;evidence:{id:string;sha256:string}[];issuedAt:string;expiresAt:string;status:'active'|'revoked';signature:string;source:'synthetic'};
export type ProgramDocument={id:string;companyId:string;type:DocumentType;name:string;key:string;sha256:string;size:number;pages:number;createdAt:string;source:'synthetic'|'pilot';scan:'synthetic-not-scanned'|'clean'};
export type ProgramIssuer={id:string;name:string;keyId:string;publicKey:JsonWebKey;privateKey:JsonWebKey;facts:Fact[];status:'active'|'suspended'};
export type Check={id:string;label:string;outcome:Outcome;reason:string;credentialIds:string[];documentIds:string[];bonus?:boolean;children?:Check[]};
export type Precheck={companyId:string;profileId:string;profileVersion:string;profileHash:string;evaluatedAt:string;checks:Check[];outcome:Outcome;credentialDigests:{id:string;digest:string}[];documents:{id:string;sha256:string}[];warnings:string[];fingerprint:string;windowStatus:'open'|'closed'|'upcoming'|'reference';networkConnected:false;officialReceipt:null};
export type ConsentChallenge={body:{context:'bizproof:program-consent:1';actor:string;owner:string;companyId:string;profileId:string;profileHash:string;fingerprint:string;nonce:string;expiresAt:string;scope:'company-and-checks-and-document-manifest'};signature:string};
export type ReviewEvent={at:string;actor:string;ruleId:string;decision:'confirmed'|'needs_changes';reason:string;evidenceIds:string[];simulation:boolean};
export type ProgramApplication={id:string;actor:string;companyId:string;profile:ProgramProfile;precheck:Precheck;consent:ConsentChallenge;createdAt:string;revision:number;status:'draft'|'internal_reviewed';history:ReviewEvent[];externalReceipt:null;mode:'synthetic'|'pilot';receipt:{keyId:string;publicKey:JsonWebKey;signature:string}};
export type ProgramData={issuers:ProgramIssuer[];credentials:ProgramCredential[];documents:ProgramDocument[];applications:ProgramApplication[];receiptKey:{keyId:string;publicKey:JsonWebKey;privateKey:JsonWebKey};scenarios:{scenario:string;companyId:string}[]};
