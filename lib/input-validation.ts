import {claims,company,policy} from './generated/business-validators';
import type {ErrorObject,ValidateFunction} from 'ajv';
export type InputIssue={path:string;code:string;message:string};
const validators={claims,company,policy};
export class InputValidationError extends Error {constructor(public issues:InputIssue[]){super('입력 형식이나 범위를 확인하세요.');}}
export function checkedInput(kind:keyof typeof validators,value:unknown){const validate=validators[kind] as unknown as ValidateFunction;if(!validate(value)){const issues=(validate.errors??[]).slice(0,20).map((e:ErrorObject)=>({path:e.instancePath,code:e.keyword,message:({required:'필수 항목이 누락되었습니다.',additionalProperties:'허용되지 않은 항목이 포함되어 있습니다.',type:'입력 자료형이 올바르지 않습니다.',format:'이메일 또는 날짜 형식을 확인하세요.',minimum:'최솟값보다 작습니다.',maximum:'최댓값을 초과했습니다.',uniqueItems:'중복된 항목을 제거하세요.',minLength:'입력 길이가 너무 짧습니다.',maxLength:'입력 길이가 너무 깁니다.'} as Record<string,string>)[e.keyword]??'입력 규칙을 확인하세요.'}));throw new InputValidationError(issues);}return value;}
