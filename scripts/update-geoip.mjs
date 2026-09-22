// Download only a public monthly database. No visitor IP or customer data leaves the server.
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
import path from 'node:path';
import {Reader} from 'maxmind';
const file=process.env.BIZPROOF_GEOIP_PATH;
if(!file||!path.isAbsolute(file))throw Error('BIZPROOF_GEOIP_PATH must be an absolute local path');
const month=new Date(Date.now()+9*3600000).toISOString().slice(0,7),temp=file+'.download',statusFile=file+'.status.json';
await mkdir(path.dirname(file),{recursive:true,mode:0o700});
let previous;try{previous=JSON.parse(await readFile(statusFile,'utf8'));}catch{}
try{
 let current;try{current=new Reader(await readFile(file));}catch{}
 if(current?.metadata.buildEpoch.toISOString().slice(0,7)===month){console.log(JSON.stringify({status:'current',month}));process.exit(0);}
 const res=await fetch(`https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz`,{signal:AbortSignal.timeout(240000)});
 if(!res.ok||!res.body)throw Error('Monthly database download unavailable: '+res.status);
 let size=0;const limit=new Transform({transform(chunk,_,done){size+=chunk.length;done(size>250*1024*1024?Error('Database size limit'):null,chunk);}});
 await pipeline(Readable.fromWeb(res.body),createGunzip(),limit,createWriteStream(temp,{mode:0o600}));
 const reader=new Reader(await readFile(temp));
 if(!reader.metadata.databaseType.toLowerCase().includes('city')||reader.metadata.buildEpoch.toISOString().slice(0,7)!==month||!reader.get('8.8.8.8')?.country?.iso_code)throw Error('Invalid monthly City database');
 await rename(temp,file);await writeFile(statusFile,JSON.stringify({month,lastSuccessAt:new Date().toISOString(),lastAttemptAt:new Date().toISOString(),status:'ok',source:'https://db-ip.com/db/download/ip-to-city-lite',license:'CC BY 4.0'}),{mode:0o600});
 console.log(JSON.stringify({status:'updated',month,bytes:size}));
}catch(e){await rm(temp,{force:true});await writeFile(statusFile,JSON.stringify({...previous,lastAttemptAt:new Date().toISOString(),status:'failed'}),{mode:0o600});console.error('GeoIP refresh failed; previous database retained:',e instanceof Error?e.message:'unknown');process.exitCode=1;}
