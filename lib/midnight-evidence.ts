import {z} from 'zod';
import {sdkContractSchema} from './midnight-sdk-schema';
const hex=z.string().regex(/^[a-f0-9]{64}$/i),identifier=z.string().min(1).max(200);
export const chainReceiptSchema=z.object({network:z.literal('undeployed'),contractAddress:hex,operation:identifier,txId:z.string().regex(/^[a-f0-9]{64,66}$/i),txHash:hex,blockHash:hex,blockHeight:z.number().int().nonnegative(),blockTimestamp:z.number().int().positive(),status:z.literal('SucceedEntirely'),mode:z.literal('midnight-finalized')});
export const midnightEvidenceSchema=z.object({format:z.literal('bizproof-web-devnet-evidence-v1'),startedAt:z.string().datetime(),completedAt:z.string().datetime(),network:z.literal('undeployed'),environment:z.literal('Local Devnet'),contractAddress:hex,
 source:z.object({origin:z.string().url(),credentialId:identifier,digest:hex,issuerPublicKey:z.object({kty:z.literal('OKP'),crv:z.literal('Ed25519'),x:identifier})}),
 outcomes:z.array(z.object({scenario:z.enum(['buyer','grant','negative']),audience:identifier,credentialId:identifier,sourceDigest:hex,webRequestId:identifier.optional(),requestId:hex,policyHash:hex.optional(),inspection:sdkContractSchema,receipt:chainReceiptSchema})).length(3),
 webResults:z.array(z.object({id:identifier,requestId:identifier,credentialId:identifier,eligible:z.literal(true),verifiedAt:z.string().datetime()})).length(2),
 receipts:z.array(chainReceiptSchema).min(10).max(40),events:z.array(z.object({at:z.string().datetime(),operation:identifier,stage:identifier,status:identifier,txId:identifier.optional(),credentialId:identifier.optional(),sourceDigest:hex.optional(),count:z.number().optional()})).max(300),
 revokedSubmissionBlocked:z.literal(true),revocationBlockStage:identifier,disclosure:z.string().min(20).max(1200)
}).superRefine((r,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(Date.parse(r.completedAt)<Date.parse(r.startedAt))bad('Invalid execution times');
 if(new Set(r.outcomes.map(x=>x.scenario)).size!==3||new Set(r.outcomes.map(x=>x.requestId)).size!==3)bad('Distinct scenarios and requests required');
 if(r.receipts.some(x=>x.contractAddress!==r.contractAddress)||new Set(r.receipts.map(x=>x.txId)).size!==r.receipts.length)bad('Contract or transaction linkage mismatch');
 for(const x of r.outcomes){if(x.credentialId!==r.source.credentialId||x.sourceDigest!==r.source.digest||!x.inspection.found||x.inspection.network!==r.network||x.inspection.contractAddress!==r.contractAddress||x.inspection.request?.id!==x.requestId||!x.inspection.request.submitted||x.inspection.request.eligible!==(x.scenario!=='negative')||x.receipt.operation!=='submit'||!r.receipts.some(t=>t.txId===x.receipt.txId&&t.txHash===x.receipt.txHash))bad('Outcome must match the source, contract and finalized submit receipt');}
 if(r.webResults.some(x=>x.credentialId!==r.source.credentialId||!r.outcomes.some(o=>o.scenario!=='negative'&&o.webRequestId===x.requestId)))bad('Original web request linkage missing');
 if(!r.receipts.some(x=>x.operation==='revokeCredential'))bad('Revocation transaction missing');
 if(!r.events.some(x=>x.stage==='proof'&&x.status==='complete'))bad('No proof provider completion recorded');
});
export type MidnightEvidence=z.infer<typeof midnightEvidenceSchema>;
