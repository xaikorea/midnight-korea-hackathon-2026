import {vleiExpectedSchema} from './vlei-verifier';
import {z} from 'zod';
const common={officialVleiVerified:z.literal(false),rootOfTrustObserved:z.literal(false),revocationConfigurationObserved:z.literal(false),adapterSourceCommit:z.string().regex(/^[a-f0-9]{40}$/),checkedAt:z.string().datetime(),notice:z.string()};
export const vleiReadinessSchema=z.object({...common,reachable:z.boolean()});
export const vleiResultSchema=z.object({...common,status:z.enum(['accepted','matched','mismatch','not-found','not-authorized','processing','aged-off']),expected:vleiExpectedSchema,authorizationMatched:z.boolean(),checks:z.array(z.object({label:z.string(),pass:z.boolean()})).default([])}).refine(v=>v.authorizationMatched===(v.status==='matched')&&(!v.authorizationMatched||(v.checks.length===4&&v.checks.every(c=>c.pass))));
