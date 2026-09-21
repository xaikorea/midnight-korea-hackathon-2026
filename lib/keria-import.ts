import {z} from 'zod';
import {vleiExpectedSchema,vleiHeadersSchema,checkSignedQuery,type VleiExpected} from './vlei-verifier';
const id=z.string().regex(/^[A-Za-z0-9_-]{44}$/);
export const keriaSnapshotSchema=z.object({
 format:z.literal('bizproof-keria-snapshot-v1'),observedAt:z.string().datetime(),offset:z.number().int().min(0).max(100000),
 identifiers:z.array(z.object({name:z.string().max(100),aid:id}).strict()).max(25),
 credentials:z.array(z.object({said:id,issuer:id,schema:id,aid:id.nullable(),lei:z.string().max(100),role:z.string().max(100),registryEvent:z.enum(['iss','bis','rev','brv','unknown'])}).strict()).max(25),
 moreIdentifiers:z.boolean(),moreCredentialsPossible:z.boolean()
}).strict();
export type KeriaSnapshot=z.infer<typeof keriaSnapshotSchema>;
export const keriaPresentationSchema=z.object({format:z.literal('bizproof-keria-presentation-v1'),observedAt:z.string().datetime(),expected:vleiExpectedSchema,cesr:z.string().min(1).max(250000)}).strict();
export type KeriaPresentation=z.infer<typeof keriaPresentationSchema>;
export function parseKeriaFile(text:string) {
 if(new TextEncoder().encode(text).length>400000)throw Error('파일은 400KB 이하여야 합니다.');
 const value:unknown=JSON.parse(text);
 return z.union([keriaSnapshotSchema,keriaPresentationSchema]).parse(value);
}
export function parseKeriaHeaders(text:string,expected:VleiExpected) {
 if(text.length>20000)throw Error('서명 파일이 너무 큽니다.');
 const headers=vleiHeadersSchema.parse(JSON.parse(text));checkSignedQuery(expected,headers);return headers;
}
