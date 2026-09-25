"""Read-only SSH export of encrypted backups. Never exports plaintext or keys."""
from pathlib import Path
import argparse, hashlib, json, re, sys

NAME = re.compile(r'^bizproof-\d{8}T\d{6}\.\d{6}Z\.tar\.gz\.encrypted\.json$')
MAX_BYTES = 512 * 1024 * 1024


def selected(root, name):
    if not NAME.fullmatch(name):
        raise ValueError('Invalid encrypted backup name')
    path = Path(root) / name
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_BYTES:
        raise ValueError('Unsafe or missing encrypted export')
    return path


def manifest(root):
    entries = []
    for path in sorted(Path(root).glob('*.encrypted.json')):
        path = selected(root, path.name)
        with path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        entries.append({'name': path.name, 'bytes': path.stat().st_size, 'sha256': digest})
    return {'version': 1, 'encryptedOnly': True, 'files': entries}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['manifest', 'export'])
    parser.add_argument('name', nargs='?')
    args = parser.parse_args()
    root = '/srv/bizproof/backups'
    if args.action == 'manifest':
        print(json.dumps(manifest(root)))
    else:
        path = selected(root, args.name or '')
        with path.open('rb') as stream:
            while chunk := stream.read(1024 * 1024):
                sys.stdout.buffer.write(chunk)
