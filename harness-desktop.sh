#!/usr/bin/env bash

# Resolve directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PORT=4173
URL="http://127.0.0.1:$PORT"

echo "⚡ Restarting DeepSeek AI Harness Server with latest code..."
kill -9 $(lsof -ti :$PORT) 2>/dev/null || true
pkill -f "node server.js" 2>/dev/null || true
sleep 0.5

nohup node server.js > "$DIR/data/server.log" 2>&1 &
SERVER_PID=$!
disown $SERVER_PID 2>/dev/null || true
echo "Server started with PID: $SERVER_PID"

# Wait for server to be responsive
for i in {1..30}; do
    if curl -s "$URL" > /dev/null 2>&1; then
        break
    fi
    sleep 0.1
done

echo "🚀 Launching DeepHarness Native Mac Desktop App..."

# Open native macOS App Bundle
open "$DIR/DeepHarness.app"

echo "✅ DeepHarness Native App launched!"
