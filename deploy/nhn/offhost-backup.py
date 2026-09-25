"""Pull encrypted exports over pinned SSH; authenticate before atomic local save."""
from pathlib import Path
import argparse, datetime, hashlib, importlib.util, json, os, re, subprocess, tempfile


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_manifest(body):
    if body.get('version') != 1 or body.get('encryptedOnly') is not True or not isinstance(body.get('files'), list) or not body['files'] or len(body['files']) > 10000:
        raise ValueError('Invalid encrypted backup manifest')
    seen = set()
    for entry in body['files']:
        if not load('export-backup').NAME.fullmatch(entry['name']) or entry['name'] in seen or not re.fullmatch('[a-f0-9]{64}', entry['sha256']) or type(entry['bytes']) is not int or not 0 < entry['bytes'] <= load('export-backup').MAX_BYTES:
            raise ValueError('Unsafe or duplicate encrypted export')
        seen.add(entry['name'])
    return sorted(body['files'], key=lambda e: e['name'])


def pull(config, transport=None):
    if not re.fullmatch(r'[a-z_][a-z0-9_-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*', config['target']):
        raise ValueError('Invalid SSH destination')
    destination = Path(config['destination']).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    private = Path(config['decryptionKey']).read_bytes()
    command = [config['ssh'], '-T', '-i', config['sshKey'], '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', '-o', 'UserKnownHostsFile=' + config['knownHosts'], config['target']]

    def remote(action, name=''):
        result = subprocess.run(command + ['sudo -n python3 /srv/bizproof/operations/export-backup.py ' + action + (' ' + name if name else '')], capture_output=True, timeout=300)
        if result.returncode:
            raise RuntimeError('Encrypted backup SSH transfer failed; no credentials logged')
        return result.stdout

    remote = transport or remote
    entries = validate_manifest(json.loads(remote('manifest')))
    copied = existing = 0
    for entry in entries:
        target = destination / entry['name']
        if target.is_symlink():
            raise ValueError('Symlink in backup destination')
        data = target.read_bytes() if target.exists() else remote('export', entry['name'])
        if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise ValueError('Encrypted transfer digest mismatch')
        verification = load('encrypted-backup').verify(data, private)
        if target.exists():
            existing += 1
            continue
        # Named temporary file stays in the ACL-restricted destination on Windows.
        with tempfile.NamedTemporaryFile(dir=destination, suffix='.partial', delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
        copied += 1
    latest = entries[-1]['name']
    stamp = datetime.datetime.strptime(latest.split('bizproof-')[1].split('.tar.gz')[0], '%Y%m%dT%H%M%S.%fZ').replace(tzinfo=datetime.timezone.utc)
    fresh = (datetime.datetime.now(datetime.timezone.utc) - stamp).total_seconds() <= 30 * 3600
    report = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'encryptedOnly': True, 'copied': copied, 'alreadyVerified': existing, 'latest': latest, 'latestFresh': fresh, 'authenticated': True, 'plaintextSha256': verification['sha256']}
    (destination / 'status.json').write_text(json.dumps(report), encoding='utf8')
    if not fresh:
        raise RuntimeError('Off-host copies authenticated but source backup is older than 30 hours')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        print(json.dumps(pull(json.loads(Path(args.config).read_text(encoding='utf8-sig')))))
    except Exception as error:
        # Do not propagate network/configuration payloads into scheduler history.
        print(json.dumps({'ok': False, 'errorType': type(error).__name__, 'message': 'Off-host backup failed; retained existing copies'}))
        raise SystemExit(1)
