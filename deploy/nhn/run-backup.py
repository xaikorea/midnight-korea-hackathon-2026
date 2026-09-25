"""Daily verified backup with an encrypted export ready for off-host copying."""
from pathlib import Path
import importlib.util, json, os

def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

root = Path('/srv/bizproof')
archive = load('backup').backup(root)
report = load('check-backup').check_backup(archive)
public = Path(__file__).with_name('backup-public.pem')
if not public.exists():
    raise RuntimeError('Off-host backup public key is missing')
os.umask(0o077)
encrypted = archive.with_suffix(archive.suffix + '.encrypted.json')
with encrypted.open('xb') as stream:
    stream.write(load('encrypted-backup').encrypt(archive.read_bytes(), public.read_bytes()))
print(json.dumps({'backup': archive.name, 'encryptedExport': encrypted.name, 'restoreCheck': report, 'offHostTransfer': 'separate-copy-required'}))
