import net from 'node:net';
export function command(host,port,operation,bytes){return new Promise((resolve,reject)=>{
 const socket=net.createConnection({host,port});let chunks=[],size=0,finished=false;
 const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(deadline);socket.destroy();error?reject(error):resolve(value);};
 const deadline=setTimeout(()=>finish(Error('ClamD timeout')),15000);
 socket.on('error',()=>finish(Error('ClamD unavailable')));socket.on('close',()=>{if(!finished)finish(Error('Incomplete ClamD response'));});
 socket.on('data',chunk=>{size+=chunk.length;if(size>4096)return finish(Error('ClamD response too large'));chunks.push(chunk);const response=Buffer.concat(chunks);const end=response.indexOf(0);if(end>=0)finish(null,response.subarray(0,end).toString('utf8'));});
 socket.on('connect',()=>{socket.write('z'+operation+'\0');if(operation==='INSTREAM'){for(let at=0;at<bytes.length;at+=65536){const part=bytes.subarray(at,at+65536),length=Buffer.alloc(4);length.writeUInt32BE(part.length);socket.write(length);socket.write(part);}socket.write(Buffer.alloc(4));}});
 });}
export async function inspectBytes(bytes,{host='127.0.0.1',port=3310}={}){
 if(!bytes.length||bytes.length>20*1024*1024)throw Error('Invalid file size');
 const version=await command(host,port,'VERSION');const match=/^ClamAV ([^/\r\n]+)\/(\d+)\/(.+)$/.exec(version);if(!match)throw Error('Signature database version unavailable');const updated=Date.parse(match[3]),now=Date.now();if(!Number.isFinite(updated)||now-updated>3*86400000||updated>now+300000)throw Error('Signature database is stale');
 const result=await command(host,port,'INSTREAM',bytes);
 if(result!=='stream: OK'&&!/^stream: .+ FOUND$/.test(result))throw Error('Incomplete scan');
 return {status:result==='stream: OK'?'clean':'infected',engine:'ClamAV '+match[1],databaseVersion:match[2],databaseUpdatedAt:new Date(updated).toISOString(),scannedAt:new Date().toISOString()};
}
