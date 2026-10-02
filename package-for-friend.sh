#!/usr/bin/env bash
# ==============================================================================
# DeepHarness — One-Click Mac Shareable Packager
# Packages DeepHarness into a single portable zip file ready to share with friends.
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "📦 Syncing latest web client and backend to DeepHarness.app bundle..."
mkdir -p DeepHarness.app/Contents/Resources/public
cp -R public/* DeepHarness.app/Contents/Resources/public/
cp server.js DeepHarness.app/Contents/Resources/server.js

# Ensure no local database or private credentials get packed into the bundle
rm -rf DeepHarness.app/Contents/Resources/data 2>/dev/null || true
rm -rf DeepHarness.app/Contents/Resources/exported_code 2>/dev/null || true

echo "🗜️  Compressing into single shareable file: DeepHarness.zip..."
rm -f DeepHarness.zip
zip -q -r -y DeepHarness.zip DeepHarness.app

FILESIZE=$(du -sh DeepHarness.zip | cut -f1)

echo ""
echo "======================================================================"
echo "🎉 SUCCESS: Single shareable file created!"
echo "📍 File: $DIR/DeepHarness.zip ($FILESIZE)"
echo ""
echo "How your friend can run it on their Mac:"
echo "1. Send them DeepHarness.zip (via AirDrop, WhatsApp, Slack, Google Drive, or USB)."
echo "2. Your friend double-clicks DeepHarness.zip to unzip."
echo "3. Drag DeepHarness.app to Applications (or Desktop) and double-click to launch!"
echo "======================================================================"
