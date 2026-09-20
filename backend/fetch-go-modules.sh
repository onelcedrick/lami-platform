#!/bin/bash
# Télécharge les modules Go manuellement dans le cache

CACHE="$HOME/go/pkg/mod/cache/download"
PROXY="https://proxy.golang.org"

# Créer le cache s'il n'existe pas
mkdir -p "$CACHE"

# wget robuste : 30 retries, timeout 120s, reprise possible
WGET="wget --tries=30 --timeout=120 --waitretry=5 -c -q --show-progress"

# Liste complète des modules (d'après go.mod)
MODULES=(
  # Directs
  "github.com/gofiber/fiber/v2|v2.52.5"
  "github.com/golang-jwt/jwt/v5|v5.2.1"
  "github.com/minio/minio-go/v7|v7.0.80"
  "github.com/rabbitmq/amqp091-go|v1.10.0"
  "github.com/rs/zerolog|v1.33.0"
  "go.mongodb.org/mongo-driver|v1.17.1"
  # Indirects
  "github.com/andybalholm/brotli|v1.0.5"
  "github.com/dustin/go-humanize|v1.0.1"
  "github.com/go-ini/ini|v1.67.0"
  "github.com/goccy/go-json|v0.10.3"
  "github.com/golang/snappy|v0.0.4"
  "github.com/google/uuid|v1.6.0"
  "github.com/klauspost/compress|v1.17.11"
  "github.com/klauspost/cpuid/v2|v2.2.8"
  "github.com/mattn/go-colorable|v0.1.13"
  "github.com/mattn/go-isatty|v0.0.20"
  "github.com/mattn/go-runewidth|v0.0.15"
  "github.com/minio/md5-simd|v1.1.2"
  "github.com/montanaflynn/stats|v0.7.1"
  "github.com/pmezard/go-difflib|v1.0.0"
  "github.com/rivo/uniseg|v0.2.0"
  "github.com/rs/xid|v1.6.0"
  "github.com/valyala/bytebufferpool|v1.0.0"
  "github.com/valyala/fasthttp|v1.51.0"
  "github.com/valyala/tcplisten|v1.0.0"
  "github.com/xdg-go/pbkdf2|v1.0.0"
  "github.com/xdg-go/scram|v1.1.2"
  "github.com/xdg-go/stringprep|v1.0.4"
  "github.com/youmark/pkcs8|v0.0.0-20240726163527-a2c0da244d78"
  "golang.org/x/crypto|v0.28.0"
  "golang.org/x/net|v0.30.0"
  "golang.org/x/sync|v0.8.0"
  "golang.org/x/sys|v0.26.0"
  "golang.org/x/text|v0.19.0"
  "gopkg.in/yaml.v3|v3.0.1"
)

TOTAL=${#MODULES[@]}
CURRENT=0
SUCCESS=0
FAIL=0

echo "═══════════════════════════════════════════"
echo " Téléchargement de $TOTAL modules Go"
echo " Cache : $CACHE"
echo "  Durée estimée : 10-20 minutes"
echo "═══════════════════════════════════════════"

for entry in "${MODULES[@]}"; do
  CURRENT=$((CURRENT + 1))
  mod=$(echo "$entry" | cut -d'|' -f1)
  ver=$(echo "$entry" | cut -d'|' -f2)
  
  echo ""
  echo "[$CURRENT/$TOTAL]  $mod@$ver"
  
  dest="$CACHE/$mod/@v"
  mkdir -p "$dest"
  
  module_ok=true
  
  for ext in info mod zip; do
    file="$dest/$ver.$ext"
    
    if [ -f "$file" ]; then
      echo "    $ver.$ext (déjà en cache)"
      continue
    fi
    
    url="$PROXY/$mod/@v/$ver.$ext"
    echo -n "    $ver.$ext ... "
    
    if $WGET "$url" -O "$file" 2>/dev/null; then
      size=$(du -h "$file" | cut -f1)
      echo " ($size)"
    else
      echo " ÉCHEC"
      module_ok=false
    fi
  done
  
  if $module_ok; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "═══════════════════════════════════════════"
echo " Résumé"
echo "═══════════════════════════════════════════"
echo "   Réussis : $SUCCESS/$TOTAL"
echo "   Échoués : $FAIL/$TOTAL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo " TOUS LES MODULES SONT TÉLÉCHARGÉS !"
  echo ""
  echo "Testez avec :"
  echo "  cd ../shared && go mod tidy"
else
  echo "  Certains modules ont échoué."
  echo "Relancez le script (les réussis seront sautés) :"
  echo "  ./fetch-go-modules.sh"
fi
