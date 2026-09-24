#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(uname -s):$(uname -m)" in
 Linux:x86_64) platform=x86_64-unknown-linux-musl; sha=e291b4bab4d4e857707008f8b1c25c2b8e0c843f6c737d0ee6c0d9ac69a6bbfb ;;
 Linux:aarch64) platform=aarch64-unknown-linux-musl; sha=7c7e38581808779d2671687c3378017bcf2fb3111a192fd1253f3472012df549 ;;
 *) echo 'Use Linux / WSL2 or the provided Docker runner.' >&2; exit 1 ;;
esac
cache="$root/.tools/compact-0.31.1-$platform"
mkdir -p "$cache"
if [[ ! -f "$cache/compiler.zip" ]]; then
 curl --fail --location --retry 3 "https://github.com/midnightntwrk/compact/releases/download/compactc-v0.31.1/compactc_v0.31.1_$platform.zip" -o "$cache/compiler.zip.part"
 mv "$cache/compiler.zip.part" "$cache/compiler.zip"
fi
echo "$sha  $cache/compiler.zip" | sha256sum --check --status
unzip -qo "$cache/compiler.zip" -d "$cache/bin"
chmod +x "$cache/bin/compactc" "$cache/bin/compactc.bin" "$cache/bin/zkir" "$cache/bin/zkir-v3"
"$cache/bin/compactc" "$root/contracts/bizproof.compact" "${1:-$root/contracts/managed}"
