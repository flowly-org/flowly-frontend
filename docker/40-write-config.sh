#!/bin/sh
# Writes runtime config so the same image can point at any backend.
set -e
cat > /usr/share/nginx/html/config.json <<JSON
{ "apiUrl": "${API_URL}" }
JSON
