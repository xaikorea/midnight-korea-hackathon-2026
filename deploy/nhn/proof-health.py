"""Private proof host liveness; never prints configuration, wallets or attributes."""
import datetime, json, shutil, subprocess, urllib.request
from pathlib import Path


def health():
    now = datetime.datetime.now(datetime.timezone.utc)
    issues = []
    for role in ['node','indexer','proof-server','executor','verifier']:
        name = 'bizproof-proof-' + role + '-1'
        result = subprocess.run(['docker','inspect','--format','{{json .State}}',name], capture_output=True, text=True, timeout=15)
        state = json.loads(result.stdout) if result.returncode == 0 else {}
        if not state.get('Running') or state.get('Health',{}).get('Status') == 'unhealthy':
            issues.append(role + '-not-ready')
        if role in ['executor','verifier'] and state.get('Running'):
            logs = subprocess.run(['docker','logs','--tail','50',name], capture_output=True, text=True, timeout=15)
            seen = False
            started = finished = None
            for line in logs.stdout.splitlines():
                try:
                    event = json.loads(line)
                    # A long proof is live while its process/container is running. The
                    # web lease and child timeout handle an unresponsive transaction.
                    at = datetime.datetime.fromisoformat(event['at'].replace('Z','+00:00')) if event.get('at') else None
                    if event.get('event') == 'started': started = at
                    if event.get('event') in ['finished','needs-review']: finished = at
                    if event.get('at') and type(event.get('discovered')) is int and (now-datetime.datetime.fromisoformat(event['at'].replace('Z','+00:00'))).total_seconds() < 180:
                        seen = True
                except (ValueError,TypeError):
                    continue
            if started and (not finished or started > finished) and (now-started).total_seconds() < 21*60: seen = True
            if not seen: issues.append(role + '-poll-stale')
    try:
        with urllib.request.urlopen('http://127.0.0.1:6300/version', timeout=5) as result:
            if result.status != 200: issues.append('proof-endpoint')
    except Exception: issues.append('proof-endpoint')
    disk = shutil.disk_usage('/srv/bizproof-proof')
    if disk.free < max(6*1024**3, disk.total*0.15): issues.append('disk-space-low')
    report = {'checkedAt':now.isoformat(),'diskFreeGiB':round(disk.free/1024**3,2),'issues':issues}
    Path('/srv/bizproof-proof/health.json').write_text(json.dumps(report),encoding='utf8')
    print(json.dumps(report))
    return bool(issues)


if __name__ == '__main__': raise SystemExit(health())
