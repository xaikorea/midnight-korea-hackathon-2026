from contextlib import closing
"""Isolated snapshot restore. Reports counts, never records or keys."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, os, sqlite3, tarfile, tempfile


def check_backup(path):
    os.umask(0o077)
    with tarfile.open(path, 'r:gz') as archive, tempfile.TemporaryDirectory() as work:
        entries = archive.getmembers()
        names = [item.name for item in entries]
        if len(set(names)) != len(names):
            raise ValueError('Duplicate archive members')
        for item in entries:
            name = PurePosixPath(item.name)
            if not item.isfile() or name.is_absolute() or '..' in name.parts or '\\' in item.name or item.size > 256 * 1024 * 1024:
                raise ValueError('Unsafe archive member')
        manifest = json.load(archive.extractfile('manifest.json'))
        if manifest.get('version') != 1 or set(names) != set(manifest['files']) | {'manifest.json'}:
            raise ValueError('Manifest members differ')
        report = {'manifestVerified': True, 'files': len(manifest['files']), 'databases': {}, 'crossLedger': 'not-present'}
        for name, expected in manifest['files'].items():
            data = archive.extractfile(name).read()
            if len(data) != expected['bytes'] or hashlib.sha256(data).hexdigest() != expected['sha256']:
                raise ValueError('Backup digest mismatch')
            if name in ['data/bizproof.sqlite', 'issuer-data/issuer.sqlite']:
                restored = Path(work) / Path(name).name
                restored.write_bytes(data)
                with closing(sqlite3.connect(restored)) as db:
                    if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                        raise ValueError('Restored SQLite is corrupt')
                    tables = db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
                    report['databases'][name] = {'integrity': 'ok', 'tables': len(tables)}
        web, issuer = Path(work) / 'bizproof.sqlite', Path(work) / 'issuer.sqlite'
        if web.exists() and issuer.exists():
            with closing(sqlite3.connect(web)) as w, closing(sqlite3.connect(issuer)) as i:
                has_jobs = w.execute("SELECT 1 FROM sqlite_master WHERE name='proof_jobs'").fetchone()
                checked = missing = stale = 0
                if has_jobs:
                    for (payload,) in w.execute('SELECT payload FROM proof_jobs'):
                        job = json.loads(payload)
                        credential = i.execute('SELECT payload FROM credentials WHERE id=? AND scope=?', (job['credentialId'], job['scope'])).fetchone()
                        checked += 1
                        if credential is None:
                            missing += 1
                        elif json.loads(credential[0]).get('status') == 'revoked' and job.get('status') not in ['blocked', 'cancelled', 'awaiting_verification', 'needs_attention']:
                            stale += 1
                report['crossLedger'] = {'jobsChecked': checked, 'missingIssuerCredentials': missing, 'revocationsToReconcile': stale}
                if missing:
                    raise ValueError('Issuer credentials are missing for saved proof jobs')
        report['scope'] = 'Archive integrity, isolated SQLite restore and proof-job issuer references; not an application failover or blockchain restore'
        return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('archive')
    args = parser.parse_args()
    print(json.dumps(check_backup(args.archive)))
