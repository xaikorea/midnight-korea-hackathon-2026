import {evaluate,type Policy} from './domain';
// Find the first UTC founding day accepted by the existing calendar-month rule.
// Reject non-monotone month-end rollover rather than silently changing a policy.
export function foundingCutoff(policy:Policy,at:Date){if(policy.maxAgeMonths===null)return 0;let lo=0,hi=Math.floor(at.getTime()/864e5)+1;const agePolicy={...policy,minRevenue:null,maxRevenue:null,region:null,requireCertification:false};while(lo<hi){const mid=Math.floor((lo+hi)/2);const foundedOn=new Date(mid*864e5).toISOString().slice(0,10);if(evaluate({revenue:0,foundedOn,region:'',certified:false},agePolicy,at).eligible)hi=mid;else lo=mid+1;}for(let day=Math.max(0,lo-35);day<=lo+35;day++){const accepted=evaluate({revenue:0,foundedOn:new Date(day*864e5).toISOString().slice(0,10),region:"",certified:false},agePolicy,at).eligible;if(accepted!==(day>=lo))throw Error("월말 업력 조건은 단일 날짜 경계로 변환할 수 없습니다. 업무 검증을 사용하세요.");}return lo;}

