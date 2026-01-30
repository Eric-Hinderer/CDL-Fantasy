# Fantasy CDL - Call of Duty League Fantasy Sports App

A fantasy sports application for the Call of Duty League, featuring classic lineups, automated scoring, and head-to-head matchups.

## Quick Start

```bash
# One-liner setup (requires Docker)
npm run setup

# Start development servers
npm run dev
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api-docs
- Bull Board (Job Monitor): http://localhost:3030

**Demo Credentials:**
- Email: `demo@example.com`
- Password: `password123`
- League Code: `DEMO24`

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React, TailwindCSS, React Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL with Prisma ORM |
| Job Queue | BullMQ with Redis |
| Real-time | Socket.io (for draft) |
| Auth | JWT with bcrypt |

## Project Structure

```
cdl-fantasy/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── lib/             # Prisma client, Redis, Queue setup
│   │   ├── middleware/      # Auth, error handling, rate limiting
│   │   ├── providers/       # Stats data providers (demo, scraper)
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── sockets/         # WebSocket handlers
│   │   ├── index.ts         # API server entry
│   │   └── worker.ts        # Background job processor
│   └── prisma/
│       ├── schema.prisma    # Database schema
│       └── seed.ts          # Demo data seeder
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router pages
│       ├── components/      # React components
│       └── lib/             # API client, stores, utilities
├── docker-compose.yml       # PostgreSQL + Redis
└── ARCHITECTURE.md          # Detailed architecture docs
```

## Features

### Implemented (MVP)
- [x] User authentication (signup/login)
- [x] League creation and management
- [x] Join leagues by invite code
- [x] Snake draft with auto-pick timer
- [x] Roster management
- [x] Lineup setting with period locks
- [x] Head-to-head matchups
- [x] Standings with win/loss records
- [x] Fantasy points calculation
- [x] Background job processing
- [x] Demo data provider for development

### Planned (Post-MVP)
- [ ] Live scoring during matches
- [ ] Waiver wire / free agency
- [ ] Trade system
- [ ] Player projections
- [ ] Mobile apps (React Native)
- [ ] Real data provider integration

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |

### Leagues
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leagues` | Get user's leagues |
| POST | `/api/leagues` | Create league |
| GET | `/api/leagues/:id` | Get league details |
| POST | `/api/leagues/join` | Join by code |

### Players
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/players` | List players |
| GET | `/api/players/:id` | Get player details |

### Lineups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lineups/team/:id/period/:periodId` | Get lineup |
| PUT | `/api/lineups/team/:id/period/:periodId` | Set lineup |
| GET | `/api/lineups/roster/:teamId` | Get roster |

### Draft
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/draft/league/:id` | Get draft state |
| POST | `/api/draft/league/:id/start` | Start draft |
| POST | `/api/draft/league/:id/pick` | Make pick |

### Standings & Matchups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/standings/league/:id` | Get standings |
| GET | `/api/matchups/league/:id` | Get matchups |
| GET | `/api/matchups/:id` | Get matchup details |

Full API documentation available at `/api-docs` when running the server.

## Database Schema

Key entities:
- **User** - Account with authentication
- **League** - Fantasy league with settings
- **FantasyTeam** - User's team in a league
- **CdlTeam** - Real CDL organization
- **CdlPlayer** - Real CDL player
- **ScoringPeriod** - Week/weekend scoring window
- **Matchup** - H2H matchup between teams
- **Lineup** - Player lineup for a period
- **PlayerStatLine** - Raw stats from matches
- **FantasyPoints** - Computed points per stat line

See `backend/prisma/schema.prisma` for full schema.

## Scoring Rules (Default)

| Stat | Points |
|------|--------|
| Kill | +1.0 |
| Death | -0.5 |
| Assist | +0.25 |
| Damage (per 100) | +0.01 |
| Objective Time (per sec) | +0.02 |
| Bomb Plant | +2.0 |
| Bomb Defuse | +2.0 |
| First Blood | +1.5 |

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| sync-schedule | Every 6 hours | Sync CDL match schedule |
| sync-match-stats | On match complete | Fetch player stats |
| compute-fantasy-points | After stats | Calculate points |
| update-standings | After period ends | Resolve matchups |
| lock-lineups | At lock time | Lock period lineups |
| auto-pick | On pick timeout | Auto-draft player |

## Data Sources

The app uses a `StatsProvider` abstraction to support multiple data sources:

1. **DemoProvider** (default) - Fake data for development
2. **BreakingPointProvider** - Scrapes breakingpoint.gg (stub)
3. **CDL API** - Official API if available (future)

To change provider:
```bash
# In backend/.env
STATS_PROVIDER="demo"  # or "breakingpoint"
```

## Development

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- npm 9+

### Manual Setup

```bash
# 1. Clone and install
git clone <repo>
cd cdl-fantasy
npm install

# 2. Start services
docker compose up -d

# 3. Setup database
cd backend
cp .env.example .env
npx prisma migrate dev
npm run db:seed

# 4. Start servers (in separate terminals)
npm run dev:backend
npm run dev:frontend
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection | Required |
| REDIS_URL | Redis connection | redis://localhost:6379 |
| JWT_SECRET | JWT signing key (32+ chars) | Required |
| JWT_EXPIRES_IN | Token expiry | 7d |
| PORT | API server port | 3001 |
| NODE_ENV | Environment | development |
| STATS_PROVIDER | Data source | demo |
| FRONTEND_URL | CORS origin | http://localhost:3000 |

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| NEXT_PUBLIC_API_URL | Backend API URL | http://localhost:3001 |

## Deployment

### Railway (Recommended)

1. Create a new project on Railway
2. Add PostgreSQL and Redis services
3. Deploy backend from GitHub
4. Deploy frontend to Vercel
5. Set environment variables

### Docker (Self-hosted)

```bash
docker compose -f docker-compose.prod.yml up -d
```

## Limitations

### MVP Limitations
1. **No live scoring** - Updates after matches (30-min polling)
2. **Web-only** - Responsive but no native apps
3. **Demo data** - Real data integration requires API access
4. **No trades** - Only roster via draft
5. **Basic draft UI** - Functional but minimal

### Data Source Limitations
The CDL doesn't provide a public API for player statistics. Options:
1. **Manual entry** - Admin enters stats after matches
2. **Scraping** - breakingpoint.gg (rate limited, may break)
3. **Paid APIs** - PandaScore, Sportradar ($$)

The `StatsProvider` abstraction allows swapping sources without code changes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT

---

Built with care for CDL fans who want a fantasy experience.
