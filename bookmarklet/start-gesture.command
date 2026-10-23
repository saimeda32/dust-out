#!/bin/bash
# Bookmark version only: serves gesture.html at http://localhost:8777 for the Hand gesture window.
# Close this Terminal window to stop it. (The Chrome extension doesn't need this.)
cd "$(dirname "$0")"
echo "Dust Out hand gesture helper is running. Leave this open during your call; close it to stop."
python3 -m http.server 8777 --bind 127.0.0.1
