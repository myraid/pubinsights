#!/usr/bin/env bash
#
# Compresses a raw Playwright take into the hero loop.
#
# A real run is minutes long, most of it spinners. This keeps a few seconds around
# each payoff moment, speeds up what remains, and emits the mp4/webm/poster set the
# landing page expects.
#
#   ./scripts/edit-demo.sh recordings/2026-09-20T22-14-20.webm
#
# Segments default to the stage offsets in the matching .timings.json: a window
# ending just after each stage completes. Override with SEGMENTS to taste:
#
#   SEGMENTS="4:3 61:4 128:5 190:6" ./scripts/edit-demo.sh recordings/take.webm
#
set -euo pipefail

INPUT="${1:-}"
OUT_DIR="public/demo"
NAME="${NAME:-hero-demo}"        # output basename; two cuts share one take
SPEED="${SPEED:-1.6}"        # playback speed-up applied after trimming
POSTER_AT="${POSTER_AT:-1}"   # seconds into the CUT to grab the poster from
TARGET_W=1280
TARGET_H=720

if [[ -z "$INPUT" || ! -f "$INPUT" ]]; then
  echo "usage: $0 <recordings/take.webm>" >&2
  exit 1
fi
command -v ffmpeg >/dev/null || { echo "ffmpeg not found — brew install ffmpeg" >&2; exit 1; }

# Derive segments from the recorder's stage marks unless told otherwise. Each stage
# mark is the moment a stage finished, so we take the seconds leading up to it.
TIMINGS="${INPUT%.webm}.timings.json"
if [[ -z "${SEGMENTS:-}" && -f "$TIMINGS" ]]; then
  SEGMENTS=$(node -e '
    const { timings } = require("./" + process.argv[1]);
    const want = ["research-done", "outline-done", "sections-planned", "draft-done"];
    const lead = { "research-done": 3, "outline-done": 4, "sections-planned": 3, "draft-done": 6 };
    const picked = want
      .map(s => timings.find(t => t.stage === s))
      .filter(Boolean)
      .map(t => `${Math.max(0, (t.at - lead[t.stage]).toFixed(2))}:${lead[t.stage]}`);
    if (!picked.length) { console.error("no known stages in timings"); process.exit(1); }
    process.stdout.write(picked.join(" "));
  ' "$TIMINGS")
  echo "Segments from $TIMINGS: $SEGMENTS"
fi
SEGMENTS="${SEGMENTS:?No segments. Pass SEGMENTS=\"start:dur ...\" or supply a .timings.json}"

mkdir -p "$OUT_DIR"

# Build one trim+reset per segment, each with its own rate, then concat.
#
# Segments are "start:duration" or "start:duration:speed". Per-segment speed is the
# point: waiting can rush past at 6x while a result the viewer needs to read holds at
# 1x. A single global rate always makes one of those wrong.
filter=""; labels=""; n=0; plan=""
for seg in $SEGMENTS; do
  IFS=: read -r start dur spd <<< "$seg"
  spd="${spd:-$SPEED}"
  filter+="[0:v]trim=start=${start}:duration=${dur},setpts=(PTS-STARTPTS)/${spd}[v${n}];"
  labels+="[v${n}]"
  plan+=$(printf '\n  %6.1fs +%4.1fs at %sx  ->%5.1fs' "$start" "$dur" "$spd" "$(echo "$dur / $spd" | bc -l)")
  n=$((n + 1))
done
filter+="${labels}concat=n=${n}:v=1:a=0[cat];"
filter+="[cat]scale=${TARGET_W}:${TARGET_H}:flags=lanczos,fps=30[out]"

echo "Cutting ${n} segments:${plan}"

# H.264 for Safari/iOS. yuv420p and +faststart are both required for inline autoplay.
ffmpeg -y -loglevel error -i "$INPUT" -filter_complex "$filter" -map "[out]" \
  -an -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 30 -preset slow \
  -movflags +faststart "$OUT_DIR/$NAME.mp4"

# VP9 is usually meaningfully smaller; browsers pick it when they can.
ffmpeg -y -loglevel error -i "$INPUT" -filter_complex "$filter" -map "[out]" \
  -an -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 "$OUT_DIR/$NAME.webm"

# Poster covers first paint and the reduced-motion case, and it is what every visitor
# sees before deciding to press play — so it must show product. The default of 1s lands
# in the login screen for a cut that opens on sign-in; pass POSTER_AT to pick a real
# moment (the research verdict, say) and check the frame before shipping it.
ffmpeg -y -loglevel error -i "$OUT_DIR/$NAME.mp4" -ss "$POSTER_AT" -frames:v 1 \
  -q:v 3 "$OUT_DIR/$NAME-poster.jpg"

duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT_DIR/$NAME.mp4")
printf '\nDuration: %.1fs (target 55-70s)\n' "$duration"
ls -lh "$OUT_DIR/$NAME".* | awk '{printf "  %-34s %s\n", $9, $5}'

awk -v d="$duration" 'BEGIN { if (d < 50 || d > 75) print "\nNote: outside the 55-70s hero target — adjust SEGMENTS or SPEED." }'
