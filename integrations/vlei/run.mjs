import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const directory=fileURLToPath(new URL('.',import.meta.url));
const check=spawnSync(process.execPath,[fileURLToPath(new URL('./check-config.mjs',import.meta.url))],{stdio:'inherit'});
if(check.status!==0)process.exit(check.status??1);
const run=spawnSync('docker',['compose','-f','compose.yaml','up','--build','-d'],{cwd:directory,stdio:'inherit'});
process.exit(run.status??1);
