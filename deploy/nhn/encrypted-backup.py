"""RSA-OAEP-SHA256 + AES-256-GCM. Encryption host only needs the public key."""
import argparse, base64, hashlib, json, os
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

CONTEXT = b'bizproof:encrypted-backup:v1'
oaep = padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=CONTEXT)
b64 = lambda data: base64.b64encode(data).decode('ascii')


def encrypt(data, public_pem):
    public = serialization.load_pem_public_key(public_pem)
    if not isinstance(public, rsa.RSAPublicKey) or public.key_size < 3072:
        raise ValueError('RSA 3072+ public key required')
    key, nonce = AESGCM.generate_key(bit_length=256), os.urandom(12)
    return json.dumps({'version': 1, 'key': b64(public.encrypt(key, oaep)), 'nonce': b64(nonce), 'ciphertext': b64(AESGCM(key).encrypt(nonce, data, CONTEXT))}).encode()


def decrypt(envelope, private_pem):
    body = json.loads(envelope)
    if body['version'] != 1:
        raise ValueError('Unsupported envelope')
    key = serialization.load_pem_private_key(private_pem, password=None).decrypt(base64.b64decode(body['key'], validate=True), oaep)
    return AESGCM(key).decrypt(base64.b64decode(body['nonce'], validate=True), base64.b64decode(body['ciphertext'], validate=True), CONTEXT)


def verify(envelope, private_pem):
    plain = decrypt(envelope, private_pem)
    return {'authenticated': True, 'bytes': len(plain), 'sha256': hashlib.sha256(plain).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['encrypt', 'verify', 'decrypt'])
    parser.add_argument('input')
    parser.add_argument('--key', required=True)
    parser.add_argument('--output')
    args = parser.parse_args()
    if args.action == 'verify':
        print(json.dumps(verify(Path(args.input).read_bytes(), Path(args.key).read_bytes())))
    else:
        if not args.output:
            parser.error('--output is required; existing files are never overwritten')
        data = Path(args.input).read_bytes()
        key = Path(args.key).read_bytes()
        result = encrypt(data, key) if args.action == 'encrypt' else decrypt(data, key)
        os.umask(0o077)
        with open(args.output, 'xb') as out:
            out.write(result)
        print(json.dumps({'action': args.action, 'bytes': Path(args.output).stat().st_size}))
