import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

// Check tracked submission material only. Never print matched values.
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const tracked=new Set(files), failures=[];
const forbiddenPath=/(^|\/)(outputs|work|\.tools|\.node-data|\.midnight-private|\.terraform|private)(\/|$)|(?:^|\/)(?:\.env(?:\..*)?|\.dev\.vars[^/]*|terraform\.tfvars(?:\.json)?|[^/]+\.auto\.tfvars(?:\.json)?|[^/]+\.tfstate[^/]*|(?:private-browser-state|storage-state|cookies)\.json|[^/]+\.(?:pem|key|p12|pfx|sqlite|sqlite3))$|^docs\/identity-and-issuer-development-plan-/;
for(const file of files){
  if(forbiddenPath.test(file)) failures.push(`${file}: private file tracked`);
  if(!existsSync(file)) continue; // staged deletions are checked again after staging.
  const data=readFileSync(file);
  if(data.subarray(0,8192).includes(0)) continue;
  const text=data.toString('utf8');
  if(/[A-Z]:[\\/]Users[\\/][^\s'"/\\]+[\\/]/i.test(text)) failures.push(`${file}: machine-specific user path`);
  if(/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(text)) failures.push(`${file}: private key material`);
  if(file.startsWith('deploy/')||file.startsWith('docs/')||file==='README.md'){
    const addresses=text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)||[];
    for(const ip of addresses){
      const parts=ip.split('.').map(Number); if(parts.some(n=>n>255)) continue;
      const example=ip==='0.0.0.0'||parts[0]===127||ip.startsWith('192.0.2.')||ip.startsWith('198.51.100.')||ip.startsWith('203.0.113.');
      if(!example) failures.push(`${file}: literal infrastructure address; use a variable or documentation address`);
    }
  }
  if(file.endsWith('.md')){
    for(const match of text.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)){
      const link=match[1].replace(/^<|>$/g,'').split('#')[0];
      if(!link||/^(?:[a-z]+:|\/)/i.test(link)) continue;
      const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),decodeURIComponent(link)));
      if(target.startsWith('outputs/')||target.startsWith('.')) continue;
      if(!tracked.has(target)&&!files.some(f=>f.startsWith(target.replace(/\/$/,'')+'/'))) failures.push(`${file}: untracked link target ${target}`);
    }
  }
}
if(failures.length){console.error([...new Set(failures)].join('\n'));process.exitCode=1;}
else console.log(`PASS publication boundaries: ${files.length} tracked files; private paths, key markers, host settings and document links checked.`);
