// Internal BizProof protocol, not an OpenID4VCI or qualified identity implementation.
import {createHash, createHmac, createPrivateKey, createPublicKey, sign, verify, timingSafeEqual} from 'node:crypto';

export const ISSUER_ID = 'issuer-independent-demo';
export const COMPANY_ID = 'issuer-demo-company';
export const CATALOG = Object.freeze({companyId: COMPANY_ID, name: '한빛테크 · 별도 발급 체험', schemaId: 'business-v1', claims: {revenue: 300000000, foundedOn: '2025-02-01', region: '서울', certified: true}});
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
export const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
export const signBody = (key, body) => sign(null, Buffer.from(canonical(body)), createPrivateKey({key, format: 'jwk'})).toString('base64');
export function verifyBody(key, body, signature) {
  try { return !key.d && verify(null, Buffer.from(canonical(body)), createPublicKey({key, format: 'jwk'}), Buffer.from(signature, 'base64')); } catch { return false; }
}
export function credentialBody(c) {
  return {context: 'bizproof:credential:issuance:v3', proofVersion: 3, remoteBinding: c.remoteBinding, body: {id:c.id, companyId:c.companyId, issuerId:c.issuerId, schemaId:c.schemaId, claims:c.claims, source:c.source, issuedAt:c.issuedAt, expiresAt:c.expiresAt, keyId:c.keyId}};
}
export function intentBody() {
  return {context:'bizproof:issuance-consent:v1', version:1, purpose:'synthetic-company-issuance', catalog:CATALOG, scope:['buyer','grant'], notice:'가상 담당자의 동의 체험. 휴대폰 본인확인·전자서명·실제 기업 인증이 아닙니다.'};
}
export function authorization(secret, payload) {
  const encoded = Buffer.from(canonical(payload)).toString('base64url');
  return encoded + '.' + createHmac('sha256', secret).update(encoded).digest('base64url');
}
export function verifyAuthorization(secret, token) {
  if (typeof token !== 'string' || token.length > 4096) throw Error('Unauthorized');
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) throw Error('Unauthorized');
  const expected = createHmac('sha256', secret).update(encoded).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw Error('Unauthorized');
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
}
