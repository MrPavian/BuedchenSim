#!/usr/bin/env bash
# Downloads and unpacks the CC0 MakeHuman data used by build_mh_resident.py into a folder outside the repository.
# Only the data folders are used; the MPFB program code in the first archive is never executed.
#
#   tools/characters/fetch_mh_data.sh <target-folder>
#   -> <target-folder>/mpfb/data        (base mesh, targets, rig, weights; CC0)
#   -> <target-folder>/assets           (makehuman_system_assets: skins, clothes, hair, eyes; CC0)
set -euo pipefail
dest="${1:?usage: fetch_mh_data.sh <target-folder>}"
mkdir -p "$dest/dl" "$dest/mpfb" "$dest/assets"

fetch() { # url file sha256
  if [ ! -f "$dest/dl/$2" ] || ! echo "$3  $dest/dl/$2" | sha256sum -c --status; then
    curl -fSL -C - --retry 5 -o "$dest/dl/$2" "$1"
  fi
  echo "$3  $dest/dl/$2" | sha256sum -c
}

fetch "https://extensions.blender.org/download/sha256:c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad/add-on-mpfb-v2.0.18.zip" \
  mpfb-2.0.18.zip c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad
fetch "https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip" \
  makehuman_system_assets_cc0.zip b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107

unzip -qo "$dest/dl/mpfb-2.0.18.zip" 'data/*' -d "$dest/mpfb"
unzip -qo "$dest/dl/makehuman_system_assets_cc0.zip" -d "$dest/assets"
echo "MakeHuman data ready: --mhdata $dest/mpfb/data --assets $dest/assets"
