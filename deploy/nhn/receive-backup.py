"""Forced SSH command for an unprivileged encrypted-only replica account."""
from pathlib import Path
import base64, hashlib, json, os, re, sys, tempfile


def receive(stream, root):
    header = stream.readline(1025)
    if len(header) > 1024 or not header.endswith(b'\n'):
        raise ValueError('Invalid transfer header')
    entry = json.loads(header)
    if not re.fullmatch(r'bizproof-\d{8}T\d{6}\.\d{6}Z\.tar\.gz\.encrypted\.json', entry['name']) or type(entry['bytes']) is not int or not 0 < entry['bytes'] <= 512*1024*1024 or not re.fullmatch('[a-f0-9]{64}', entry['sha256']):
        raise ValueError('Invalid encrypted replica')
    data = stream.read(entry['bytes'] + 1)
    if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise ValueError('Transfer digest mismatch')
    envelope = json.loads(data)
    if set(envelope) != {'version', 'key', 'nonce', 'ciphertext'} or envelope['version'] != 1 or len(base64.b64decode(envelope['key'], validate=True)) < 384 or len(base64.b64decode(envelope['nonce'], validate=True)) != 12 or len(base64.b64decode(envelope['ciphertext'], validate=True)) < 16:
        raise ValueError('Only encrypted backup envelopes accepted')
    root = Path(root)
    target = root / entry['name']
    if target.is_symlink():
        raise ValueError('Unsafe replica destination')
    if target.exists():
        if target.read_bytes() != data:
            raise ValueError('Existing replica differs; refusing overwrite')
        return {**entry, 'stored': True, 'alreadyPresent': True}
    with tempfile.NamedTemporaryFile(dir=root, suffix='.partial', delete=False) as out:
        temporary = Path(out.name)
        out.write(data)
        out.flush()
        os.fsync(out.fileno())
    try:
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)
    return {**entry, 'stored': True, 'alreadyPresent': False}


if __name__ == '__main__':
    os.umask(0o077)
    try:
        print(json.dumps(receive(sys.stdin.buffer, '/srv/bizproof-replica/web')))
    except Exception:
        print(json.dumps({'stored': False}))
        raise SystemExit(1)
