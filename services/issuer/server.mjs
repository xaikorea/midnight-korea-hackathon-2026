import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {openIssuer, IssuerError} from './core.mjs';
import {hash, verifyAuthorization} from './protocol.mjs';

export function startIssuer({directory, secret, port=3201, host='127.0.0.1'}) {
  if (!secret || secret.length<48) throw Error('ISSUER_SERVICE_SECRET requires at least 48 characters');
  const issuer=openIssuer(directory);
  const server=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try {
      if(req.method==='GET'&&req.url==='/health'){res.end(JSON.stringify({ok:true,mode:'synthetic-only'}));return;}
      if(Number(req.headers['content-length'])>16384)throw new IssuerError(413,'요청이 너무 큽니다.');
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16384)throw new IssuerError(413,'요청이 너무 큽니다.');chunks.push(chunk);}
      const raw=Buffer.concat(chunks).toString('utf8');let body;try{body=raw?JSON.parse(raw):null;}catch{throw new IssuerError(400,'JSON 형식을 확인하세요.');}
      let auth;try{auth=verifyAuthorization(secret,req.headers.authorization?.replace(/^BizProof /,''));}catch{throw new IssuerError(401,'서비스 인증이 필요합니다.');}
      if(auth.aud!=='bizproof-issuer-demo'||auth.mode!=='synthetic'||auth.method!==req.method||auth.path!==req.url||auth.bodyHash!==hash(body)||!/^[a-f0-9]{64}$/.test(auth.scope)||typeof auth.jti!=='string'||auth.jti.length>80||!Number.isSafeInteger(auth.iat)||!Number.isSafeInteger(auth.exp)||auth.iat>Date.now()+5000||auth.exp<=Date.now()||auth.exp-auth.iat>30000||auth.exp<=auth.iat)throw new IssuerError(401,'유효하지 않은 서비스 요청입니다.');
      issuer.consumeAuthorization(auth);
      const url=new URL(req.url,'http://issuer.internal');
      const value=issuer.handle(req.method,url.pathname,auth.scope,body,url.searchParams);
      res.end(JSON.stringify(value));
    }catch(e){res.statusCode=e instanceof IssuerError?e.status:500;res.end(JSON.stringify({error:e instanceof IssuerError?e.message:'발급 서비스 처리에 실패했습니다.',incident:e instanceof IssuerError?undefined:randomUUID()}));}
  });
  server.requestTimeout=10000;server.headersTimeout=5000;server.keepAliveTimeout=3000;
  server.listen(port,host);
  return {server,issuer,close:()=>new Promise((resolve,reject)=>server.close(e=>{issuer.close();e?reject(e):resolve();}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const instance=startIssuer({directory:process.env.ISSUER_DATA_DIR??'outputs/issuer-demo',secret:process.env.ISSUER_SERVICE_SECRET,host:process.env.ISSUER_HOST??'127.0.0.1',port:Number(process.env.ISSUER_PORT??3201)});
  instance.server.on('listening',()=>console.log('Independent synthetic issuer listening on '+instance.server.address().port));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void instance.close().then(()=>process.exit(0)));
}
