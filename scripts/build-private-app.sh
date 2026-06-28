#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT="$ROOT/dist-app"

rm -rf -- "$OUTPUT"
mkdir -p "$OUTPUT"

APP_PAGES="
admin.html
bookings.html
buy-list.html
call-sheet.html
clients.html
consultations.html
content.html
crm.html
dashboard.html
delivery.html
finance.html
gear.html
lists.html
messages.html
projects.html
quick-capture.html
shoot-settings.html
shot-lists.html
studio-assistant.html
templates.html
timeline.html
wedding-funds.html
"

APP_FILES="
app-readable.css
content.css
content.js
icon-180.png
icon-192.png
icon-32.png
icon-512.png
nc-supabase-sync.js
ncstudios-logo-mark-transparent.png
register-sw.js
site.webmanifest
studio-assistant-config.js
studio-assistant.css
studio-assistant.js
style.css
supabase-config.js
sw.js
wedding-funds-config.js
wedding-funds.css
wedding-funds.js
"

for file in $APP_PAGES $APP_FILES; do
  cp "$ROOT/$file" "$OUTPUT/$file"
done

cp "$ROOT/dashboard.html" "$OUTPUT/index.html"
cp -R "$ROOT/assets" "$OUTPUT/assets"
cp "$ROOT/deploy/private-app/_headers" "$OUTPUT/_headers"

printf 'Private app bundle created at %s\n' "$OUTPUT"
