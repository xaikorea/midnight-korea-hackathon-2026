from pathlib import Path
import sqlite3,tarfile,datetime,tempfile,os
root=Path('/srv/bizproof');out=root/'backups';out.mkdir(parents=True,exist_ok=True);os.chmod(out,0o700)
name='bizproof-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.tar.gz'
with tempfile.TemporaryDirectory(dir=out) as work:
 snapshot=Path(work)/'bizproof.sqlite'
 with sqlite3.connect(str(root/'data/bizproof.sqlite')) as source,sqlite3.connect(str(snapshot)) as target:source.backup(target)
 issuer_snapshot=None
 if (root/'issuer-data/issuer.sqlite').exists():
  issuer_snapshot=Path(work)/'issuer.sqlite'
  with sqlite3.connect(str(root/'issuer-data/issuer.sqlite')) as source,sqlite3.connect(str(issuer_snapshot)) as target:source.backup(target)
 with tarfile.open(out/name,'w:gz') as archive:
  archive.add(snapshot,arcname='data/bizproof.sqlite')
  if (root/'data/evidence').exists():archive.add(root/'data/evidence',arcname='data/evidence')
  archive.add(root/'secrets/runtime.env',arcname='secrets/runtime.env')
  if issuer_snapshot:
   archive.add(issuer_snapshot,arcname='issuer-data/issuer.sqlite')
   archive.add(root/'issuer-data/issuer-key.json',arcname='issuer-data/issuer-key.json')
   for item in ['issuer-client.env','issuer-service.env']:
    archive.add(root/'secrets'/item,arcname='secrets/'+item)
 os.chmod(out/name,0o600)
print(name)
