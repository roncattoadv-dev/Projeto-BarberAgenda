#!/bin/bash
# Monitor de saúde do BarberFlow — roda via cron a cada 15 min
# Loga em /var/log/barberflow-health.log e alerta no console se crítico
set -euo pipefail

LOG="/var/log/barberflow-health.log"
ALERT=0
MSG=""

ts() { date '+%Y-%m-%d %H:%M'; }

# ── RAM ──────────────────────────────────────────────────────────────────────
MEM_AVAIL=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)  # MB
MEM_TOTAL=$(awk '/MemTotal/     {print int($2/1024)}' /proc/meminfo)
MEM_PCT=$(( (MEM_TOTAL - MEM_AVAIL) * 100 / MEM_TOTAL ))
if [ "$MEM_PCT" -ge 85 ]; then
  ALERT=1; MSG="$MSG [CRITICO] RAM em uso: ${MEM_PCT}% (disponivel: ${MEM_AVAIL}MB)"
elif [ "$MEM_PCT" -ge 75 ]; then
  MSG="$MSG [AVISO] RAM em uso: ${MEM_PCT}% (disponivel: ${MEM_AVAIL}MB)"
fi

# ── DISCO ────────────────────────────────────────────────────────────────────
DISK_PCT=$(df / --output=pcent | tail -1 | tr -d ' %')
if [ "$DISK_PCT" -ge 85 ]; then
  ALERT=1; MSG="$MSG [CRITICO] Disco em uso: ${DISK_PCT}%"
elif [ "$DISK_PCT" -ge 75 ]; then
  MSG="$MSG [AVISO] Disco em uso: ${DISK_PCT}%"
fi

# ── CONTAINERS BARBERFLOW ────────────────────────────────────────────────────
for ctn in code-app-1 code-api-1 code-redis-1 barberflow_supabase-db-1 barberflow_supabase-kong-1; do
  STATUS=$(docker inspect "$ctn" --format '{{.State.Status}}' 2>/dev/null || echo "missing")
  if [ "$STATUS" != "running" ]; then
    ALERT=1; MSG="$MSG [CRITICO] Container $ctn: $STATUS"
  fi
done

# ── POSTGRES CONEXOES ────────────────────────────────────────────────────────
CONN=$(docker exec barberflow_supabase-db-1 psql -U postgres -t -A \
  -c "SELECT count(*) FROM pg_stat_activity WHERE state != 'idle'" 2>/dev/null || echo "0")
if [ "$CONN" -ge 80 ]; then
  ALERT=1; MSG="$MSG [CRITICO] Conexoes DB ativas: $CONN/100"
elif [ "$CONN" -ge 60 ]; then
  MSG="$MSG [AVISO] Conexoes DB ativas: $CONN/100"
fi

# ── BACKUP RECENTE ───────────────────────────────────────────────────────────
LATEST=$(ls -t /root/backups/barberflow/barberflow_*.sql.gz 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  MSG="$MSG [AVISO] Nenhum backup encontrado"
else
  AGE_H=$(( ( $(date +%s) - $(stat -c %Y "$LATEST") ) / 3600 ))
  if [ "$AGE_H" -ge 30 ]; then
    ALERT=1; MSG="$MSG [CRITICO] Ultimo backup ha ${AGE_H}h (esperado <25h)"
  fi
fi

# ── LOG & SAIDA ──────────────────────────────────────────────────────────────
STATUS_LINE="$(ts) | RAM:${MEM_PCT}% DISCO:${DISK_PCT}% DB_CONN:${CONN} |${MSG:-  OK}"
echo "$STATUS_LINE" >> "$LOG"

# Mantém últimas 500 linhas
tail -500 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"

if [ "$ALERT" -eq 1 ]; then
  echo "=============================" >> "$LOG"
  echo "$(ts) ALERTA CRITICO:$MSG" >> "$LOG"
  echo "=============================" >> "$LOG"
  # Exibe no stderr para aparecer em qualquer pipe/notificação do cron
  echo "BARBERFLOW ALERTA:$MSG" >&2
  exit 1
fi

exit 0
