"""Restore both services on an isolated network; never switch public traffic."""
from pathlib import Path
import argparse, importlib.util, json, os, subprocess, tarfile, time, uuid


def check(archive):
    spec = importlib.util.spec_from_file_location('check_backup', Path(__file__).with_name('check-backup.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.check_backup(archive)


def restore_files(archive, destination):
    destination = Path(destination).resolve()
    if destination.exists():
        raise ValueError('Restore destination must be new')
    report = check(archive)
    destination.mkdir(parents=True, mode=0o700)
    with tarfile.open(archive, 'r:gz') as source:
        for entry in source.getmembers():
            target = (destination / entry.name).resolve()
            if not target.is_relative_to(destination):
                raise ValueError('Unsafe restore destination')
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with target.open('xb') as out:
                out.write(source.extractfile(entry).read())
            target.chmod(0o600)
    return report


def docker(*args):
    result = subprocess.run(['docker', *args], capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError('Recovery Docker command failed: ' + args[0])
    return result.stdout.strip()


def prepare(archive, port):
    os.umask(0o077)
    if not 3300 <= port <= 3399:
        raise ValueError('Use a loopback-only recovery port in 3300..3399')
    stamp = 'dr-' + uuid.uuid4().hex[:12]
    root = Path('/srv/bizproof/recovery') / stamp
    report = restore_files(archive, root)
    services = {}
    for role, container, uid, directory, files, target in [
        ('issuer', 'bizproof-issuer-1', 10002, 'issuer-data', ['issuer-service.env'], '/issuer-data'),
        ('app', 'bizproof-app-1', 10001, 'data', ['runtime.env', 'issuer-client.env', 'proof-jobs.env'], '/data')]:
        volume = root / directory
        volume.chmod(0o750)
        os.chown(volume, uid, uid)
        for path in volume.rglob('*'):
            os.chown(path, uid, uid)
            path.chmod(0o750 if path.is_dir() else 0o600)
        services[role] = {'image': docker('inspect', '--format', '{{.Image}}', container),
                          'env_file': [str(root / 'secrets' / f) for f in files if (root / 'secrets' / f).exists()],
                          'volumes': [str(volume) + ':' + target],
                          'networks': ['isolated'], 'restart': 'no', 'mem_limit': '512m' if role == 'app' else '192m',
                          'security_opt': ['no-new-privileges:true'], 'cap_drop': ['ALL'],
                          'healthcheck': {'test': ['CMD', 'node', '-e', "fetch('http://127.0.0.1:" + ('3100/guide' if role == 'app' else '3201/health') + "').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], 'interval': '5s', 'timeout': '4s', 'retries': 10}}
    services['app'].update({'ports': ['127.0.0.1:' + str(port) + ':3100'], 'environment': {'BIZPROOF_APP_ORIGIN': 'http://127.0.0.1:' + str(port), 'BIZPROOF_ISSUER_URL': 'http://issuer:3201', 'BIZPROOF_IDENTITY_PILOT': 'false'}, 'depends_on': {'issuer': {'condition': 'service_healthy'}}})
    compose = {'name': 'bizproof-' + stamp, 'services': services, 'networks': {'isolated': {'internal': True}}}
    (root / 'compose.json').write_text(json.dumps(compose), encoding='utf8')
    (root / 'restore-report.json').write_text(json.dumps({'archive': Path(archive).name, 'validation': report, 'port': port, 'publicTrafficSwitched': False}), encoding='utf8')
    try:
        docker('compose', '-f', str(root / 'compose.json'), 'up', '-d', '--wait', '--wait-timeout', '120')
    except Exception:
        docker('compose', '-f', str(root / 'compose.json'), 'down')
        raise
    # Docker 29 does not publish ports for an internal-only bridge. An SSH local
    # forward reaches this private container IP without giving it Internet egress.
    app = docker('compose', '-f', str(root / 'compose.json'), 'ps', '-q', 'app')
    address = docker('inspect', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', app)
    return {'directory': str(root), 'port': port, 'sshForwardTarget': address + ':3100', 'isolated': True, 'servicesHealthy': True, 'validation': report}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'stop'])
    parser.add_argument('path')
    parser.add_argument('--port', type=int, default=3310)
    args = parser.parse_args()
    if args.action == 'prepare':
        print(json.dumps(prepare(args.path, args.port)))
    else:
        root = Path(args.path).resolve()
        if root.parent != Path('/srv/bizproof/recovery') or not (root / 'restore-report.json').is_file():
            raise ValueError('Only a marked isolated recovery drill can be stopped')
        docker('compose', '-f', str(root / 'compose.json'), 'down')
        print(json.dumps({'stopped': str(root), 'restoredFilesRetained': True}))
