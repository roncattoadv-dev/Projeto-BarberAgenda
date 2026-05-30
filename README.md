# 💈 BarberFlow SaaS

Sistema SaaS multi-tenant de agendamento online para barbearias e salões de beleza.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Infra:** Docker Swarm + Nginx + PostgreSQL 16 + Redis 7
- **Deploy:** EasyPanel + Traefik (HTTPS automático)

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Super Admin** | Gerencia tenants, planos, cupons, suporte e logs LGPD |
| **Admin da Barbearia** | Agenda, profissionais, serviços, estoque e financeiro |
| **Agendamento Online** | Widget público para clientes finais agendarem |
| **Especificações** | Schema SQL, rotas de API e roadmap interativos |

## Executar localmente

```bash
# Com Docker (recomendado)
docker compose -f docker-compose.dev.yml up -d
# App em http://localhost:3000

# Sem Docker
npm install
npm run dev
```

## Deploy em produção (EasyPanel)

```bash
# 1. Criar secrets no Swarm
./deploy.sh secrets

# 2. Build + push + deploy
./deploy.sh release

# 3. Verificar
./deploy.sh status
```

Ver [`deploy.sh`](deploy.sh) e [`docker-compose.swarm.yml`](docker-compose.swarm.yml) para detalhes completos.

## Estrutura do projeto

```
src/
├── components/
│   ├── ClientAdminPanel.tsx     # Painel da barbearia (agenda, financeiro, estoque)
│   ├── CustomerBookingFlow.tsx  # Widget de agendamento do cliente
│   ├── SuperAdminPanel.tsx      # Console de governança da plataforma
│   └── SaaSArchitect.tsx        # Especificações técnicas e SQL
├── hooks/
│   └── useToast.tsx             # Sistema de notificações toast
├── App.tsx                      # Estado global e roteamento de views
├── data.ts                      # Dados iniciais de demonstração
├── types.ts                     # Interfaces TypeScript
└── index.css                    # Estilos globais e animações
```

## Próximos passos

- [ ] Integração Supabase (Auth + PostgreSQL + RLS)
- [ ] Notificações WhatsApp via Evolution API
- [ ] Pagamentos com Asaas/Stripe
- [ ] Quebrar `ClientAdminPanel.tsx` em sub-componentes por tab
- [ ] Testes com Vitest + Testing Library
