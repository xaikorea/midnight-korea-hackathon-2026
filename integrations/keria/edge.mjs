import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {adminOrigin,identifier,snapshot,presentation,authorizationHeaders,operation} from './core.mjs';

const [command,...args]=process.argv.slice(2);
if(!command||command==='--help') {
  console.log('KERIA edge tool (existing agent only)\nCommands:\n  snapshot <output.json> [offset]\n  presentation <SAID> <output.json>\n  sign <identifier-name> <holder-AID> <headers.json>\n  operation <operation-name> <output.json>\nRequired nonsecret environment: KERIA_ADMIN_URL, KERIA_AGENT_AID\nOptional KERIA_TIER: low (default), med, high; must match original controller.\nPasscode is requested privately in a local terminal. Never pass it in arguments/environment.\nOutputs contain identity information; protect and delete when no longer needed.');
  process.exit(0);
}
function secretPrompt() {
  if(!process.stdin.isTTY) throw Error('An interactive local terminal is required');
  return new Promise((resolveSecret,reject)=>{
    let value='';const input=process.stdin;process.stderr.write('Signify passcode (hidden): ');
    input.setRawMode(true);input.setEncoding('utf8');input.resume();
    function finish(error){input.off('data',onData);input.setRawMode(false);input.pause();process.stderr.write('\n');if(error)reject(error);else resolveSecret(value);value='';}
    function onData(chunk){for(const c of chunk){if(c==='\u0003'){finish(Error('Cancelled'));return;}if(c==='\r'||c==='\n'){finish();return;}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(/^[A-Za-z0-9_-]$/.test(c)&&value.length<256)value+=c;}}
    input.on('data',onData);
  });
}
try {
  const lengths={snapshot:[1,2],presentation:[2],sign:[3],operation:[2]};
  if(!lengths[command]?.includes(args.length)) throw Error('Use --help');
  const origin=adminOrigin(process.env.KERIA_ADMIN_URL||'http://127.0.0.1:3901');
  const agent=identifier(process.env.KERIA_AGENT_AID);
  const tierName=process.env.KERIA_TIER||'low';if(!['low','med','high'].includes(tierName))throw Error('Invalid tier');
  const nativeFetch=globalThis.fetch;
  // Process-local SDK transport: fixed origin, no redirects, bounded body and request time.
  globalThis.fetch=async(input,init={})=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(url.origin!==origin) throw Error('Unexpected SDK destination');
    const res=await nativeFetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!res.ok) throw Error('KERIA request failed');
    const reader=res.body?.getReader();const chunks=[];let size=0;
    if(reader)while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('KERIA response too large');}chunks.push(value);}
    return new Response([204,205,304].includes(res.status)?null:Buffer.concat(chunks),{status:res.status,headers:res.headers});
  };
  const {SignifyClient,ready,Tier}=await import('signify-ts');await ready();
  let bran=await secretPrompt();
  const client=new SignifyClient(origin,bran,Tier[tierName]);bran='';
  // Check the expected agent before SDK connect's potential initial delegation approval.
  const state=await client.state();if(state.agent?.i!==agent)throw Error('Agent pin mismatch');
  client.state=async()=>state;
  await client.connect();if(client.agent?.pre!==agent)throw Error('Agent pin mismatch');
  let output,path;
  if(command==='snapshot'){output=await snapshot(client,args[1]===undefined?0:Number(args[1]));path=args[0];}
  if(command==='presentation'){output=await presentation(client,args[0]);path=args[1];}
  if(command==='sign'){output=await authorizationHeaders(client,args[0],args[1]);path=args[2];}
  if(command==='operation'){output=await operation(client,args[0]);path=args[1];}
  const dest=resolve(path);await mkdir(dirname(dest),{recursive:true});
  await writeFile(dest,JSON.stringify(output,null,2),{flag:'wx',mode:0o600});
  console.log('Output saved. No credential or business approval has been performed.');
} catch {
  // SDK errors can include credential payloads; do not echo upstream messages or stacks.
  console.error('KERIA 작업 실패. 인수, 에이전트 AID, 연결, 자격 형식과 출력 파일의 기존 여부를 확인하세요. 재시도 시 --help를 참고하세요.');
  process.exitCode=1;
}
