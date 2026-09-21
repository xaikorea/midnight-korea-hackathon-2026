import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {inspectBytes} from './clamd-client.mjs';
const token=process.env.CLAMAV_BRIDGE_TOKEN;
if(!token||token.length<32||/[\r\n]/.test(token))throw Error('CLAMAV_BRIDGE_TOKEN requires at least 32 characters');
let active=0;
const server=http.createServer(async(req,res)=>{
 const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 const supplied=Buffer.from(req.headers.authorization??''),expected=Buffer.from('Bearer '+token);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){req.resume();return reply(401,{error:'Unauthorized'});}
 if(req.method!=='POST'||req.url!=='/scan'){req.resume();return reply(404,{error:'Not found'});}
 if(req.headers['content-type']!=='application/octet-stream'){req.resume();return reply(415,{error:'Binary input required'});}
 if(active>=2){req.resume();return reply(503,{error:'Scanner busy'});}active++;
 try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024){reply(413,{error:'File too large'});req.destroy();return;}chunks.push(chunk);}const bytes=Buffer.concat(chunks);const result=await inspectBytes(bytes,{host:process.env.CLAMD_HOST||'127.0.0.1',port:Number(process.env.CLAMD_PORT||3310)});reply(200,{...result,sha256:createHash('sha256').update(bytes).digest('hex')});}catch{if(!res.headersSent)reply(503,{error:'Scan incomplete or database unavailable'});}finally{active--;}
});
server.requestTimeout=20000;server.headersTimeout=10000;server.timeout=25000;
server.listen(Number(process.env.CLAMAV_BRIDGE_PORT||4012),'127.0.0.1',()=>console.log('ClamAV bridge listening on loopback'));
