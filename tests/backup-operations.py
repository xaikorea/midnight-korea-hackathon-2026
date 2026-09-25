from contextlib import closing
import datetime, hashlib, importlib.util, io, json, sqlite3, tarfile, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'deploy/nhn' / (name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result
backup, check, health = module('backup'), module('check-backup'), module('health')


class OperationsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ['data', 'issuer-data', 'secrets']:
            (self.root / name).mkdir()
        with closing(sqlite3.connect(self.root / 'data/bizproof.sqlite')) as db, db:
            db.execute('CREATE TABLE proof_jobs(payload TEXT)')
            db.execute('INSERT INTO proof_jobs VALUES (?)', (json.dumps({'credentialId': 'c1', 'scope': 's1', 'status': 'blocked'}),))
        with closing(sqlite3.connect(self.root / 'issuer-data/issuer.sqlite')) as db, db:
            db.execute('CREATE TABLE credentials(id TEXT, scope TEXT, payload TEXT)')
            db.execute('INSERT INTO credentials VALUES (?,?,?)', ('c1', 's1', json.dumps({'status': 'revoked'})))
        for name in ['secrets/runtime.env', 'secrets/issuer-client.env', 'secrets/issuer-service.env', 'issuer-data/issuer-key.json']:
            (self.root / name).write_text('fixture-not-a-secret')

    def test_isolated_restore_and_original_unchanged(self):
        original = (self.root / 'data/bizproof.sqlite').read_bytes()
        report = check.check_backup(backup.backup(self.root))
        self.assertEqual(report['crossLedger']['jobsChecked'], 1)
        self.assertEqual(report['crossLedger']['missingIssuerCredentials'], 0)
        self.assertEqual(original, (self.root / 'data/bizproof.sqlite').read_bytes())

    def test_missing_ledger_never_creates_empty_database(self):
        (self.root / 'data/bizproof.sqlite').unlink()
        with self.assertRaises(RuntimeError): backup.backup(self.root)
        self.assertFalse((self.root / 'data/bizproof.sqlite').exists())

    def test_full_restore_preserves_sources_and_refuses_overwrite(self):
        originals = {name: (self.root / name).read_bytes() for name in ['data/bizproof.sqlite', 'issuer-data/issuer.sqlite', 'issuer-data/issuer-key.json']}
        archive = backup.backup(self.root)
        destination = self.root / 'recovery'
        restored = module('restore-drill')
        restored.restore_files(archive, destination)
        for name, original in originals.items():
            self.assertEqual((self.root / name).read_bytes(), original)
        self.assertEqual((destination / 'issuer-data/issuer-key.json').read_bytes(), originals['issuer-data/issuer-key.json'])
        with closing(sqlite3.connect(destination / 'data/bizproof.sqlite')) as restored_db:
            self.assertEqual(json.loads(restored_db.execute('SELECT payload FROM proof_jobs').fetchone()[0])['credentialId'], 'c1')
        with self.assertRaisesRegex(ValueError, 'must be new'):
            restored.restore_files(archive, destination)

    def test_encrypted_replica_replay_tamper_and_path_guard(self):
        import base64
        receive = module('receive-backup').receive
        # Envelope-shaped fixture: receiver has no decryption key and checks transport integrity only.
        data = json.dumps({'version': 1, 'key': base64.b64encode(b'k'*384).decode(), 'nonce': base64.b64encode(b'n'*12).decode(), 'ciphertext': base64.b64encode(b'c'*32).decode()}).encode()
        entry = {'name': 'bizproof-20260925T005956.000025Z.tar.gz.encrypted.json', 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        stream = lambda e, d=data: io.BytesIO(json.dumps(e).encode()+b'\n'+d)
        result = receive(stream(entry), self.root)
        self.assertTrue(result['stored'])
        self.assertTrue(receive(stream(entry), self.root)['alreadyPresent'])
        for patch in [{'name':'../outside'}, {'sha256':'0'*64}, {'bytes':entry['bytes']-1}]:
            with self.assertRaises(ValueError): receive(stream({**entry, **patch}), self.root)
        self.assertFalse((self.root.parent / 'outside').exists())

    def test_offhost_manifest_rejects_unsafe_or_duplicate_exports(self):
        validate = module('offhost-backup').validate_manifest
        item = {'name': 'bizproof-20260925T005956.000025Z.tar.gz.encrypted.json', 'bytes': 500, 'sha256': 'a'*64}
        self.assertEqual(validate({'version':1, 'encryptedOnly':True, 'files':[item]}), [item])
        for entries in [[item, item], [{**item, 'name':'runtime.env'}], [{**item, 'bytes':-1}]]:
            with self.assertRaises(ValueError): validate({'version':1, 'encryptedOnly':True, 'files':entries})

    def test_missing_issuer_fails(self):
        (self.root / 'issuer-data/issuer.sqlite').unlink()
        with self.assertRaises(RuntimeError): backup.backup(self.root)

    def test_mismatched_issuer_reference_fails(self):
        with closing(sqlite3.connect(self.root / 'issuer-data/issuer.sqlite')) as db, db:
            db.execute('DELETE FROM credentials')
        with self.assertRaisesRegex(ValueError, 'missing'): check.check_backup(backup.backup(self.root))

    def test_tampered_archive_fails(self):
        original = backup.backup(self.root)
        altered = self.root / 'altered.tar.gz'
        with tarfile.open(original) as src, tarfile.open(altered, 'w:gz') as dst:
            for member in src.getmembers():
                data = src.extractfile(member).read()
                if member.name == 'secrets/runtime.env': data += b'changed'
                member.size = len(data)
                dst.addfile(member, io.BytesIO(data))
        with self.assertRaisesRegex(ValueError, 'digest mismatch'): check.check_backup(altered)

    def test_path_traversal_fails_without_extraction(self):
        path = self.root / 'malicious.tar.gz'
        with tarfile.open(path, 'w:gz') as dst:
            entry = tarfile.TarInfo('../outside')
            dst.addfile(entry, io.BytesIO())
        with self.assertRaisesRegex(ValueError, 'Unsafe'): check.check_backup(path)

    def test_health_thresholds(self):
        states = {name: {'Running': True, 'Health': {'Status': 'healthy'}} for name in ['bizproof-app-1', 'bizproof-issuer-1', 'bizproof-caddy-1']}
        self.assertEqual(health.evaluate(30*1024**3, 10*1024**3, 1, states), [])
        self.assertIn('disk-space-low', health.evaluate(30*1024**3, 2*1024**3, 1, states))
        self.assertIn('backup-stale-or-missing', health.evaluate(30*1024**3, 10*1024**3, 31, states))

    def test_encryption_roundtrip_and_tamper(self):
        try:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric import rsa
        except ImportError:
            self.skipTest('cryptography not installed')
        crypto = module('encrypted-backup')
        pair = rsa.generate_private_key(public_exponent=65537, key_size=3072)
        private = pair.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
        public = pair.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        envelope = crypto.encrypt(b'backup-fixture', public)
        self.assertEqual(crypto.verify(envelope, private)['bytes'], 14)
        self.assertEqual(crypto.decrypt(envelope, private), b'backup-fixture')
        damaged = json.loads(envelope)
        damaged['ciphertext'] = 'A' + damaged['ciphertext'][1:] if damaged['ciphertext'][0] != 'A' else 'B' + damaged['ciphertext'][1:]
        with self.assertRaises(Exception): crypto.verify(json.dumps(damaged), private)


if __name__ == '__main__': unittest.main()
