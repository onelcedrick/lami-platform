#!/bin/bash
cd "$(dirname "$0")"

echo " Arrêt des services..."
for pidfile in logs/*.pid; do
  if [ -f "$pidfile" ]; then
    name=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      echo "   $name arrêté (PID $pid)"
    fi
    rm -f "$pidfile"
  fi
done
echo " Tous les services sont arrêtés."
