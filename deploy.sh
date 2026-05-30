#!/bin/bash
# ============================================================
# BarberAgenda — Deploy Script para EasyPanel / Docker Swarm
# Uso: bash deploy.sh [build|push|deploy|secrets|status|logs]
# ============================================================
set -euo pipefail

# ── Configurações — edite conforme seu ambiente ───────────────
REGISTRY="${REGISTRY:-registry.easypanel.io}"
PROJECT="${PROJECT:-barberflow}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
STACK_NAME="${STACK_NAME:-barberflow}"
COMPOSE_FILE="docker-compose.swarm.yml"

# Cores para output
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Verifica pré-requisitos ───────────────────────────────────
check_requirements() {
  command -v docker >/dev/null 2>&1 || error "Docker não encontrado"
  docker info >/dev/null 2>&1      || error "Docker daemon não está rodando"
  
  if ! docker node ls >/dev/null 2>&1; then
    warn "Swarm não iniciado. Inicializando..."
    docker swarm init || error "Falha ao iniciar o Swarm"
  fi
  info "Requisitos OK — Swarm ativo"
}

# ── Criação de secrets no Swarm ───────────────────────────────
create_secrets() {
  info "Configurando secrets do Swarm..."

  # Postgres password
  if ! docker secret inspect postgres_password >/dev/null 2>&1; then
    echo -n "Digite a senha do PostgreSQL: "
    read -rs PG_PASS
    echo
    echo "$PG_PASS" | docker secret create postgres_password -
    info "Secret 'postgres_password' criado"
  else
    warn "Secret 'postgres_password' já existe — pulando"
  fi

  # Redis password
  if ! docker secret inspect redis_password >/dev/null 2>&1; then
    echo -n "Digite a senha do Redis: "
    read -rs REDIS_PASS
    echo
    echo "$REDIS_PASS" | docker secret create redis_password -
    info "Secret 'redis_password' criado"
  else
    warn "Secret 'redis_password' já existe — pulando"
  fi
}

# ── Build da imagem ───────────────────────────────────────────
build_image() {
  info "Fazendo build da imagem: ${REGISTRY}/${PROJECT}/app:${TAG}"
  
  docker build \
    --target runtime \
    --tag "${REGISTRY}/${PROJECT}/app:${TAG}" \
    --tag "${REGISTRY}/${PROJECT}/app:latest" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --cache-from "${REGISTRY}/${PROJECT}/app:latest" \
    .
  
  info "Build concluído: ${REGISTRY}/${PROJECT}/app:${TAG}"
}

# ── Push para registry ────────────────────────────────────────
push_image() {
  info "Enviando imagem para o registry..."
  docker push "${REGISTRY}/${PROJECT}/app:${TAG}"
  docker push "${REGISTRY}/${PROJECT}/app:latest"
  info "Push concluído"
}

# ── Deploy no Swarm ───────────────────────────────────────────
deploy_stack() {
  info "Fazendo deploy da stack '${STACK_NAME}'..."
  
  export REGISTRY PROJECT TAG
  
  docker stack deploy \
    --compose-file "${COMPOSE_FILE}" \
    --with-registry-auth \
    --prune \
    "${STACK_NAME}"
  
  info "Stack '${STACK_NAME}' deploiada com sucesso!"
  info "Aguardando serviços ficarem healthy..."
  sleep 5
  docker stack services "${STACK_NAME}"
}

# ── Status dos serviços ───────────────────────────────────────
show_status() {
  info "Status da stack '${STACK_NAME}':"
  docker stack services "${STACK_NAME}"
  echo ""
  info "Nodes do Swarm:"
  docker node ls
}

# ── Logs ──────────────────────────────────────────────────────
show_logs() {
  SERVICE="${1:-${STACK_NAME}_app}"
  info "Logs do serviço '${SERVICE}':"
  docker service logs --follow --tail 100 "${SERVICE}"
}

# ── Rollback ─────────────────────────────────────────────────
rollback() {
  info "Fazendo rollback do serviço ${STACK_NAME}_app..."
  docker service rollback "${STACK_NAME}_app"
}

# ── Remove stack ─────────────────────────────────────────────
remove_stack() {
  warn "Removendo stack '${STACK_NAME}'..."
  warn "Os volumes de dados NÃO serão removidos."
  read -rp "Confirmar? (s/N): " CONFIRM
  [[ "$CONFIRM" =~ ^[sS]$ ]] || { info "Cancelado."; exit 0; }
  docker stack rm "${STACK_NAME}"
}

# ── Menu principal ────────────────────────────────────────────
main() {
  CMD="${1:-help}"
  
  case "$CMD" in
    secrets)  check_requirements; create_secrets ;;
    build)    build_image ;;
    push)     push_image ;;
    deploy)   check_requirements; deploy_stack ;;
    release)  build_image; push_image; deploy_stack ;;
    status)   show_status ;;
    logs)     show_logs "${2:-}" ;;
    rollback) rollback ;;
    remove)   remove_stack ;;
    help|*)
      echo ""
      echo "BarberAgenda — Deploy Script"
      echo ""
      echo "Uso: bash deploy.sh <comando>"
      echo ""
      echo "Comandos:"
      echo "  secrets   Cria os secrets do Swarm (postgres_password, redis_password)"
      echo "  build     Faz build da imagem Docker"
      echo "  push      Envia a imagem para o registry"
      echo "  deploy    Deploia/atualiza a stack no Swarm"
      echo "  release   build + push + deploy (fluxo completo)"
      echo "  status    Mostra status dos serviços"
      echo "  logs      Mostra logs (default: serviço app)"
      echo "  rollback  Reverte o serviço app para versão anterior"
      echo "  remove    Remove a stack do Swarm"
      echo ""
      echo "Variáveis de ambiente:"
      echo "  REGISTRY=registry.easypanel.io"
      echo "  PROJECT=barberflow"
      echo "  TAG=<git-sha>  (padrão: git rev-parse --short HEAD)"
      echo "  STACK_NAME=barberflow"
      echo ""
      ;;
  esac
}

main "$@"
