import {ageFoundingCutoff} from './policy-age';
import type {Policy} from './domain';
export function foundingCutoff(policy: Policy, at: Date) { return ageFoundingCutoff(policy, at); }
