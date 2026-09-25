"""Read-only host checks; reports operational metadata to systemd journal."""
import datetime, json, shutil, subprocess, sys, time
from pathlib import Path


def evaluate(total, free, backup_age_hours, containers):
    issues = []
    if free < 4 * 1024**3 or free / total < 0.15:
        issues.append('disk-space-low')
    if backup_age_hours is None or backup_age_hours > 30:
        issues.append('backup-stale-or-missing')
    for name in ['bizproof-app-1', 'bizproof-issuer-1', 'bizproof-caddy-1']:
        state = containers.get(name, {})
        if not state.get('Running') or state.get('Health', {}).get('Status', 'healthy') != 'healthy':
            issues.append(name + '-unhealthy')
    return issues


if __name__ == '__main__':
    root = Path('/srv/bizproof')
    usage = shutil.disk_usage(root)
    backups = list((root / 'backups').glob('bizproof-*.tar.gz'))
    age = (time.time() - max(p.stat().st_mtime for p in backups)) / 3600 if backups else None
    containers = {}
    for name in ['bizproof-app-1', 'bizproof-issuer-1', 'bizproof-caddy-1']:
        result = subprocess.run(['docker', 'inspect', '--format', '{{json .State}}', name], capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            containers[name] = json.loads(result.stdout)
    issues = evaluate(usage.total, usage.free, age, containers)
    report = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'diskFreeGiB': round(usage.free/1024**3, 2), 'diskUsedPercent': round(100*(1-usage.free/usage.total), 1), 'backupAgeHours': round(age, 1) if age is not None else None, 'issues': issues}
    print(json.dumps(report))
    sys.exit(1 if issues else 0)
