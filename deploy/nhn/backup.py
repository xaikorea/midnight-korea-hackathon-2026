from contextlib import closing
"""Private, atomic snapshots; never modifies a live database."""
from pathlib import Path
import argparse, datetime, hashlib, json, os, sqlite3, tarfile, tempfile


def backup(root):
    root = Path(root).resolve()
    out = root / 'backups'
    out.mkdir(parents=True, exist_ok=True)
    os.chmod(out, 0o700)
    os.umask(0o077)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    target = out / ('bizproof-' + stamp + '.tar.gz')
    with tempfile.TemporaryDirectory(dir=out) as work:
        work = Path(work)
        files = {}
        for name in ['data/bizproof.sqlite', 'issuer-data/issuer.sqlite']:
            source = root / name
            if name.startswith('issuer-') and not source.exists():
                if (root / 'secrets/issuer-client.env').exists():
                    raise RuntimeError('Configured issuer ledger is missing')
                continue
            if not source.is_file() or source.is_symlink():
                raise RuntimeError('Required ledger is missing or unsafe: ' + name)
            snapshot = work / source.name
            with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as src, closing(sqlite3.connect(snapshot)) as dst:
                src.backup(dst)
                if dst.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                    raise RuntimeError('SQLite integrity check failed: ' + name)
            files[name] = snapshot
        names = ['secrets/runtime.env']
        if 'issuer-data/issuer.sqlite' in files:
            names += ['issuer-data/issuer-key.json', 'secrets/issuer-client.env', 'secrets/issuer-service.env']
        for name in names:
            path = root / name
            if not path.is_file() or path.is_symlink():
                raise RuntimeError('Required configuration is missing or unsafe: ' + name)
            files[name] = path
        if (root / 'secrets/proof-jobs.env').is_file():
            files['secrets/proof-jobs.env'] = root / 'secrets/proof-jobs.env'
        for directory in ['data/evidence', 'proof-worker-config']:
            for path in (root / directory).rglob('*'):
                if path.is_symlink():
                    raise RuntimeError('Symlink in backup input')
                if path.is_file():
                    files[path.relative_to(root).as_posix()] = path
        manifest = {'version': 1, 'createdAt': stamp, 'consistency': 'sequential-sqlite-snapshots', 'files': {}}
        frozen = work / 'files'
        frozen.mkdir()
        for index, (name, path) in enumerate(files.items()):
            data = path.read_bytes()
            copy = frozen / str(index)
            copy.write_bytes(data)
            files[name] = copy
            manifest['files'][name] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
        metadata = work / 'manifest.json'
        metadata.write_text(json.dumps(manifest), encoding='utf8')
        temporary = target.with_suffix('.partial')
        try:
            with tarfile.open(temporary, 'w:gz') as archive:
                for name, path in files.items():
                    archive.add(path, arcname=name)
                archive.add(metadata, arcname='manifest.json')
            os.chmod(temporary, 0o600)
            with temporary.open('rb+') as stream:
                os.fsync(stream.fileno())
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='/srv/bizproof')
    args = parser.parse_args()
    print(backup(args.root).name)
