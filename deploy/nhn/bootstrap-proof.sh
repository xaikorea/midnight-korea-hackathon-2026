#!/bin/sh
# Some NHN images omit cloud-init's package module. Explicit, idempotent fallback.
set -eu
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2 python3-cryptography ca-certificates
systemctl enable --now docker
install -d -m 0755 /srv/bizproof-proof /srv/bizproof-proof/releases /srv/bizproof-proof/operations
install -d -m 0700 /srv/bizproof-proof/secrets /srv/bizproof-proof/backups /srv/bizproof-proof/chain
