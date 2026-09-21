import businessSchema from './schemas/business-inputs.json';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {RuleEffect,type JsonSchema7,type UISchemaElement} from '@jsonforms/core';
export type Field={name:string;label:string;type?:string;value?:string;options?:{value:string;label:string}[];help?:string;required?:boolean;min?:number;max?:number;showWhen?:{field:string;value:string}};
export type FormSpec={title:string;description:string;fields:Field[];submitLabel?:string;onSubmit:(values:Record<string,string>)=>Promise<void>};
export const formAjv=addFormats(new Ajv({allErrors:true,strict:false,$data:true}));
formAjv.addFormat('past-date',{type:'string',validate:(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value&&Date.parse(value)<=Date.now()});
export function formDefinition(fields:Field[]){
 const properties:Record<string,JsonSchema7>={},required:string[]=[],elements:UISchemaElement[]=[];
 for(const f of fields){const numeric=f.type==='number';properties[f.name]=numeric?{type:'integer',...(f.min!==undefined?{minimum:f.min}:{}),...(f.max!==undefined?{maximum:f.max}:{})}:{type:'string',...(f.required!==false?{minLength:1,pattern:'\\S'}:{}),...(f.type==='email'?{format:'email'}:{}),...(f.type==='date'?{format:'past-date'}:{}),...(f.options?{enum:f.options.map(o=>o.value)}:{})};
 if(f.name==='revenue')properties[f.name]={...properties[f.name],...businessSchema.definitions.claims.properties.revenue};
 if(f.name==='region')properties[f.name]={...properties[f.name],maxLength:businessSchema.definitions.text.maxLength};
 if(f.required!==false&&!f.showWhen)required.push(f.name);
 elements.push({type:'Control',scope:'#/properties/'+f.name,label:f.label,options:{inputType:f.type??'text',choices:f.options,help:f.help},...(f.showWhen?{rule:{effect:RuleEffect.SHOW,condition:{scope:'#/properties/'+f.showWhen.field,schema:{const:f.showWhen.value},failWhenUndefined:true}}}:{})} as UISchemaElement);
 }
 const schema:JsonSchema7={type:'object',properties,required,additionalProperties:false};
 if(properties.minRevenue&&properties.maxRevenue)properties.minRevenue={...properties.minRevenue,allOf:[{maximum:{$data:'/maxRevenue'}} as unknown as JsonSchema7]};
 return {schema,uischema:{type:'VerticalLayout',elements} as UISchemaElement};
}
export function initialFormData(fields:Field[]){return Object.fromEntries(fields.filter(f=>f.value!==undefined&&f.value!=='').map(f=>[f.name,f.type==='number'?Number(f.value):f.value]));}
export function submittedValues(fields:Field[],data:Record<string,unknown>){return Object.fromEntries(fields.map(f=>[f.name,f.showWhen&&data[f.showWhen.field]!==f.showWhen.value?'':data[f.name]===undefined?'':String(data[f.name])]));}

