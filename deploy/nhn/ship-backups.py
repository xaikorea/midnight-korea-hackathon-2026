"""Send encrypted envelopes to one pinned replica host; no plaintext/key export."""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, re, subprocess


def ship(config, root='/srv/bizproof/backups'):
    if not re.fullmatch(r'[a-z_][a-z0-9_-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*', config['target']):
        raise ValueError('Invalid pinned replica destination')
    root = Path(root)
    journal = root / 'replication.json'
    history = json.loads(journal.read_text()) if journal.exists() else {'copies': {}}
    spec = importlib.util.spec_from_file_location('export_backup', Path(__file__).with_name('export-backup.py'))
    export = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(export)
    entries = export.manifest(root)['files']
    if not entries:
        raise RuntimeError('No encrypted exports available')
    copied = 0
    for entry in entries:
        # Probe the latest copy every time; other immutable copies use receipts.
        if history['copies'].get(entry['name']) == entry['sha256'] and entry != entries[-1]:
            continue
        command = ['ssh', '-T', '-i', config['key'], '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', '-o', 'UserKnownHostsFile='+config['knownHosts'], config['target']]
        data = (root / entry['name']).read_bytes()
        payload = json.dumps(entry).encode() + b'\n' + data
        result = subprocess.run(command, input=payload, capture_output=True, timeout=300)
        if result.returncode:
            raise RuntimeError('Encrypted replica delivery failed')
        received = json.loads(result.stdout)
        if received.get('stored') is not True or any(received.get(k) != entry[k] for k in ['name','bytes','sha256']):
            raise RuntimeError('Replica acknowledgment mismatch')
        history['copies'][entry['name']] = entry['sha256']
        copied += 1
    history['checkedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    history['latest'] = entries[-1]['name']
    temp = journal.with_suffix('.partial')
    temp.write_text(json.dumps(history), encoding='utf8')
    os.replace(temp, journal)
    return {'encryptedOnly': True, 'replicatedCopies': len(history['copies']), 'checkedThisRun': copied, 'latest': history['latest'], 'checkedAt': history['checkedAt']}


if __name__ == '__main__':
    os.umask(0o077)
    config = json.loads(Path('/srv/bizproof/secrets/backup-replica.json').read_text())
    print(json.dumps(ship(config)))
