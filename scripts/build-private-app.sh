#!/bin/sh
set -eu

OUT_DIR="dist-app"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

copy_file() {
  if [ -f "$1" ]; then
    mkdir -p "$OUT_DIR/$(dirname "$1")"
    cp "$1" "$OUT_DIR/$1"
  else
    echo "Missing private app file: $1" >&2
    exit 1
  fi
}

copy_optional_file() {
  if [ -f "$1" ]; then
    mkdir -p "$OUT_DIR/$(dirname "$1")"
    cp "$1" "$OUT_DIR/$1"
  fi
}

copy_file "admin.html"
copy_file "app-readable.css"
copy_file "bookings.html"
copy_file "buy-list.html"
copy_file "call-sheet.html"
copy_file "clients.html"
copy_file "consultations.html"
copy_file "content.css"
copy_file "content.html"
copy_file "content.js"
copy_file "crm.html"
copy_file "dashboard.html"
copy_file "delivery.html"
copy_file "finance.html"
copy_file "gear.html"
copy_file "index.html"
copy_file "lists.html"
copy_file "messages.html"
copy_file "projects.html"
copy_file "quick-capture.html"
copy_file "shoot-settings.html"
copy_file "shot-lists.html"
copy_file "studio-assistant-config.js"
copy_file "studio-assistant.css"
copy_file "studio-assistant.html"
copy_file "studio-assistant.js"
copy_file "style.css"
copy_file "templates.html"
copy_file "timeline.html"
copy_file "wedding-funds-config.js"
copy_file "wedding-funds.css"
copy_file "wedding-funds.html"
copy_file "wedding-funds.js"

copy_file "app.js"
copy_file "nc-supabase-sync.js"
copy_file "register-sw.js"
copy_file "site.webmanifest"
copy_file "supabase-config.js"
copy_file "supabase-js.js"
copy_file "sw.js"

copy_file "icon-32.png"
copy_file "icon-180.png"
copy_file "icon-192.png"
copy_file "icon-512.png"
copy_file "ncstudios-logo-mark-transparent.png"
copy_optional_file "ncstudios-logo-transparent.png"
copy_optional_file "ncstudios-logo-1024.png"

copy_optional_file "assets/71d1f7c5-7d2d-4f92-ba2c-5bc2c141cdfe.png"
copy_optional_file "assets/jason-roisin-engagement-card.jpg"
copy_optional_file "assets/nc-about-portrait.jpg"
copy_optional_file "assets/nc-contact-gold.svg"
copy_optional_file "assets/nc-instagram-gold.svg"
copy_optional_file "assets/fonts/NC_Font_.ttf"
copy_optional_file "assets/fonts/NC_Font_Lighter.ttf"
copy_optional_file "assets/fonts/nc-font-lighter-preview.png"

if [ -f "deploy/private-app/_headers" ]; then
  cp "deploy/private-app/_headers" "$OUT_DIR/_headers"
fi

echo "Private app built in $OUT_DIR"
