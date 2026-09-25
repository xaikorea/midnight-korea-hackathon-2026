import {z} from 'zod';

export type PolicyExtensions = {ageReferenceDate?: string; ageComparison?: 'lt' | 'lte'; sourceUrl?: string; sourceVersion?: string};
export type AgePolicy = PolicyExtensions & {maxAgeMonths: number | null};
const dayMs = 86_400_000;
export function calendarDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value && value >= '1970-01-01';
}
export const policyExtensionFields = {
  ageReferenceDate: z.string().refine(calendarDate, '유효한 기준일을 입력하세요.').optional(),
  ageComparison: z.enum(['lt', 'lte']).optional(),
  sourceUrl: z.string().max(2048).url().refine(value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  }, '인증정보 없는 HTTPS 원문 주소가 필요합니다.').optional(),
  sourceVersion: z.string().trim().min(1).max(160).optional(),
};
export function validatePolicyExtensions(policy: AgePolicy, context: z.RefinementCtx) {
  const hasDate = policy.ageReferenceDate !== undefined, hasComparison = policy.ageComparison !== undefined;
  if (hasDate !== hasComparison || ((hasDate || hasComparison) && policy.maxAgeMonths === null)) {
    context.addIssue({code: 'custom', path: ['ageReferenceDate'], message: '고정 기준일, 미만·이내 구분, 최대 업력을 함께 입력하세요.'});
  }
  if ((policy.sourceUrl !== undefined) !== (policy.sourceVersion !== undefined)) {
    context.addIssue({code: 'custom', path: ['sourceUrl'], message: '원문 주소와 공고 회차·버전을 함께 입력하세요.'});
  }
}

// Fixed rules compare date-only anniversaries, clamping leap/month-end days.
// Legacy rules retain UTC rollover and exact-instant semantics for signed history.
function maximumAgeFacts(foundedOn: string, policy: AgePolicy, at: Date) {
  if (!Number.isFinite(at.getTime())) throw Error('판정 시각을 확인하세요.');
  if (policy.maxAgeMonths === null) {
    if (policy.ageReferenceDate !== undefined || policy.ageComparison !== undefined) throw Error('기준일에는 최대 업력이 필요합니다.');
    return {now: at.getTime(), deadline: null as number | null};
  }
  const months = policy.maxAgeMonths;
  if (!Number.isInteger(months) || months < 0 || months > 1200) throw Error('업력 제한을 확인하세요.');
  const anniversary = new Date(foundedOn);
  if (!Number.isFinite(anniversary.getTime())) throw Error('설립일을 확인하세요.');
  if (policy.ageReferenceDate === undefined && policy.ageComparison === undefined) {
    anniversary.setUTCMonth(anniversary.getUTCMonth() + months);
    return {now: at.getTime(), deadline: anniversary.getTime()};
  }
  if (!policy.ageReferenceDate || !calendarDate(policy.ageReferenceDate) || !['lt', 'lte'].includes(policy.ageComparison ?? '')) throw Error('고정 기준일과 비교 조건을 확인하세요.');
  const originalDay = anniversary.getUTCDate();
  anniversary.setUTCDate(1);
  anniversary.setUTCMonth(anniversary.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 1, 0)).getUTCDate();
  anniversary.setUTCDate(Math.min(originalDay, lastDay));
  return {now: Date.parse(policy.ageReferenceDate), deadline: anniversary.getTime() - (policy.ageComparison === 'lt' ? 1 : 0)};
}
export function ageFacts(foundedOn: string, policy: AgePolicy, at: Date) {
  const facts = maximumAgeFacts(foundedOn, policy, at);
  // A company not yet founded on the reference date cannot have an eligible age.
  return policy.ageReferenceDate && foundedOn > policy.ageReferenceDate ? {...facts, deadline: facts.now - 1} : facts;
}
export function assertAgeProofSupported(foundedOn: string, policy: AgePolicy) {
  // The current Compact circuit represents a lower founding-date bound only.
  // Fail closed for the upper-bound exception until a new circuit supports it.
  if (policy.ageReferenceDate && foundedOn > policy.ageReferenceDate) throw Error('설립일이 업력 기준일 이후입니다. 현재 회로는 이 상한 조건의 미충족 증명을 지원하지 않습니다.');
}
export function agePass(foundedOn: string, policy: AgePolicy, at: Date) {
  const {now, deadline} = ageFacts(foundedOn, policy, at);
  return deadline === null || now <= deadline;
}
export function ageLabel(policy: AgePolicy) {
  return `${policy.ageReferenceDate ? policy.ageReferenceDate + ' 기준 · ' : ''}업력 ${policy.maxAgeMonths}개월 ${policy.ageComparison === 'lt' ? '미만' : '이내'}`;
}
export function ageFoundingCutoff(policy: AgePolicy, at: Date) {
  if (policy.maxAgeMonths === null) { ageFacts('1970-01-01', policy, at); return 0; }
  let lo = 0, hi = Math.floor(ageFacts('1970-01-01', policy, at).now / dayMs) + 1;
  const accepted = (day: number) => {
    const facts = maximumAgeFacts(new Date(day * dayMs).toISOString().slice(0, 10), policy, at);
    return facts.deadline === null || facts.now <= facts.deadline;
  };
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (accepted(mid)) hi = mid; else lo = mid + 1; }
  // Old month-end rollover can be non-monotone; never approximate it on chain.
  for (let day = Math.max(0, lo - 35); day <= lo + 35; day++) {
    if (accepted(day) !== (day >= lo)) throw Error('월말 업력 조건은 단일 날짜 경계로 변환할 수 없습니다. 업무 검증을 사용하세요.');
  }
  return lo;
}
