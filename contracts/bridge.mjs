import {createServer} from 'node:http';
import {runDemo} from './runtime.mjs';
import {runRequest} from './request-runner.mjs';
const server=createServer(async(req,res)=>{const send=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));};
 if(req.headers.host!=='127.0.0.1:4011'&&req.headers.host!=='localhost:4011')return send(403,{error:'Loopback requests only'});
 if(req.headers.origin)return send(403,{error:'Browser origins are not permitted; use authenticated application API'});
 if(req.url?.startsWith('/sdk/')){try{const {sdkRequest}=await import('./sdk/http.ts');return send(200,await sdkRequest(req.method,req.url));}catch{return send(503,{error:'Midnight SDK 실행 실패. 구성·컴파일 산출물·인덱서 연결을 확인하세요.'});}}
 if(req.url==='/health'&&req.method==='GET')return send(200,{mode:'compact-local',networkConnected:false,proofGenerated:false,compiler:'0.31.1',requestExecution:true});
 if(req.url==='/demo'&&req.method==='POST'){try{return send(200,runDemo());}catch{return send(500,{error:'Circuit execution failed'});}}
 if(req.url==='/request'&&req.method==='POST'){if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});try{let body='';for await(const chunk of req){body+=chunk.toString();if(body.length>16000)return send(413,{error:'Input too large'});}return send(200,runRequest(JSON.parse(body)));}catch{return send(422,{error:'Circuit input or execution rejected'});}}
 return send(404,{error:'Unknown route'});
});
server.requestTimeout=10000;server.headersTimeout=10000;
server.listen(4011,'127.0.0.1',()=>console.log('BizProof Compact bridge: http://127.0.0.1:4011 (local circuit execution; no on-chain transaction)'));
