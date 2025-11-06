#!/usr/bin/env bash
# Bash thumbnail generator for video stickers
# Usage: ./scripts/generate-thumbs.sh
# Requires ffmpeg available on PATH. Produces {name}.thumb.jpg next to each .mp4/.webm under assets/packs.

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKS_DIR="$ROOT_DIR/assets/packs"
LOG_FILE="$ROOT_DIR/tmp/thumb-generation.log"

mkdir -p "$ROOT_DIR/tmp"
echo "Thumbnail generation started: $(date -Is)" > "$LOG_FILE"

shopt -s globstar
for video in "$PACKS_DIR"/**/*.{mp4,webm}; do
  [ -f "$video" ] || continue
  dir=$(dirname "$video")
  base=$(basename "$video")
  name="${base%.*}"
  outThumb="$dir/$name.thumb.jpg"

  if [ -f "$outThumb" ]; then
    size=$(stat -c%s "$outThumb" 2>/dev/null || stat -f%z "$outThumb")
    if [ "$size" -gt 512 ]; then
      echo "SKIP: $video -> $outThumb (exists, size=$size)" >> "$LOG_FILE"
      continue
    fi
  fi

  # Use -y and -update 1 to avoid image2 pattern errors
  if ffmpeg -y -ss 00:00:00.500 -i "$video" -frames:v 1 -q:v 2 -update 1 "$outThumb" 2> >(tee -a "$LOG_FILE" >&2); then
    echo "OK: $video -> $outThumb" >> "$LOG_FILE"
  else
    echo "FAIL: $video -> $outThumb" >> "$LOG_FILE"
  fi

done

echo "Thumbnail generation finished: $(date -Is)" >> "$LOG_FILE"

echo "Thumbnail generation complete. See $LOG_FILE for details."