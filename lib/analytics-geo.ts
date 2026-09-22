import {stat,readFile} from 'node:fs/promises';
import {Reader,type CityResponse} from 'maxmind';
import {isIP} from 'node:net';

let cache:{file:string;mtime:number;reader:Reader<CityResponse>}|undefined;
let pending:Promise<void>|undefined,lastCheck=0,checkedFile='',failed=false,updateFailed=false;
const configuredFile=()=>process.env.BIZPROOF_GEOIP_PATH??'';
async function refresh(){
 const file=configuredFile();if(!file)return;
 if(pending)return pending;if(Date.now()-lastCheck<60000&&checkedFile===file)return;
 pending=(async()=>{try{const info=await stat(file);if(info.size>250*1024*1024)throw Error('Geo database exceeds limit');if(cache?.file!==file||cache.mtime!==info.mtimeMs){const reader=new Reader<CityResponse>(await readFile(file));if(!reader.metadata.databaseType.toLowerCase().includes('city'))throw Error('City database required');cache={file,mtime:info.mtimeMs,reader};}failed=false;try{updateFailed=JSON.parse(await readFile(file+'.status.json','utf8')).status==='failed';}catch{updateFailed=false;}}catch{failed=true;}finally{lastCheck=Date.now();checkedFile=file;pending=undefined;}})();await pending;
}
export function publicGeoIp(ip:string){
 if(!isIP(ip))return false;
 if(ip.includes(':'))return /^2[0-9a-f]{3}:/i.test(ip)&&!/^2001:db8:/i.test(ip);
 const [a,b]=ip.split('.').map(Number);return a!==0&&a!==10&&a!==127&&a<224&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&b===168)&&!(a===100&&b>=64&&b<=127)&&!/^192\.0\.(0|2)\.|^198\.(18|19|51)\.|^203\.0\.113\./.test(ip);
}
const clean=(value:unknown)=>typeof value==='string'&&value.length<=100&&!/[\x00-\x1f]/.test(value)?value:null;
const localized=(names:unknown)=>{const value=names as Record<string,string>|undefined;return clean(value?.ko??value?.en);};
export async function geoStatus(){await refresh();const active=cache?.file===configuredFile()?cache:undefined;return {enabled:!!configuredFile(),available:!!active,updatedAt:active?new Date(active.mtime).toISOString():null,buildDate:active?active.reader.metadata.buildEpoch.toISOString():null,status:!configuredFile()?'disabled':failed||updateFailed?(active?'update-failed':'unavailable'):'ready',provider:'DB-IP Lite',schedule:'매월 갱신 · 실패 시 이전 데이터 유지'};}
export async function enrichLocation<T extends {ip:string|null;country:string|null;region:string|null;city:string|null;geoSource:string}>(location:T):Promise<T>{
 if(!location.ip||location.country||!configuredFile()||!publicGeoIp(location.ip))return location;
 await refresh();if(cache?.file!==configuredFile())return location;
 try{const value=cache.reader.get(location.ip);const country=value?.country?.iso_code;if(!country||!/^([A-Z]{2})$/.test(country))return location;return {...location,country,region:localized(value.subdivisions?.[0]?.names),city:localized(value.city?.names),geoSource:'db-ip-lite-local'};}catch{return location;}
}
