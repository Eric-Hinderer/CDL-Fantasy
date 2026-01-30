# Fantasy CDL - Architecture & Tech Stack

## Tech Stack Choices

### Backend: Node.js + Express + TypeScript
**Rationale:**
- Fast MVP development with familiar ecosystem
- Excellent TypeScript support for type safety
- Rich middleware ecosystem (auth, validation, etc.)
- Easy to hire for / maintain long-term
- Async/await patterns work well with job queues

### Database: PostgreSQL
**Rationale:**
- Strong relational data model (leagues → teams → rosters → lineups)
- ACID compliance critical for draft picks, scoring calculations
- Excellent indexing for query performance
- Prisma ORM provides type-safe queries and migrations
- Free tiers available on Railway, Supabase, Neon

### Background Jobs: BullMQ + Redis
**Rationale:**
- Battle-tested job queue with retry logic built-in
- Redis provides fast, reliable message broker
- Easy job scheduling (cron-like patterns)
- Built-in monitoring with Bull Board UI
- Supports job priorities, rate limiting, concurrency control

### Frontend: Next.js 14 (App Router)
**Rationale:**
- Server components reduce bundle size
- Built-in API routes if needed
- Fast development with React ecosystem
- Responsive design works on mobile browsers for MVP
- Can add React Native later sharing business logic
- Vercel deployment is trivial

### ORM: Prisma
**Rationale:**
- Auto-generated TypeScript types from schema
- Declarative migrations
- Excellent DX with Prisma Studio for debugging
- Built-in connection pooling

### Hosting Strategy (Production)
- **API + Worker**: Railway or Render (easy container deployment)
- **Database**: Railway PostgreSQL or Supabase
- **Redis**: Railway Redis or Upstash
- **Frontend**: Vercel (free tier supports most traffic)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│                                                                          │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│   │  Web App     │    │  Mobile App  │    │  Admin Panel │             │
│   │  (Next.js)   │    │  (Future)    │    │  (Future)    │             │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘             │
│          │                   │                   │                      │
└──────────┼───────────────────┼───────────────────┼──────────────────────┘
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                    │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    Express.js API Server                        │   │
│   │                                                                  │   │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │   │
│   │  │  Auth   │  │ Leagues │  │  Draft  │  │ Lineups │           │   │
│   │  │ Routes  │  │ Routes  │  │ Routes  │  │ Routes  │           │   │
│   │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘           │   │
│   │       │            │            │            │                  │   │
│   │       └────────────┴────────────┴────────────┘                  │   │
│   │                          │                                       │   │
│   │                          ▼                                       │   │
│   │  ┌─────────────────────────────────────────────────────────┐   │   │
│   │  │                   Service Layer                          │   │   │
│   │  │  AuthService | LeagueService | DraftService | etc.      │   │   │
│   │  └─────────────────────────────────────────────────────────┘   │   │
│   │                          │                                       │   │
│   └──────────────────────────┼──────────────────────────────────────┘   │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │     Redis       │  │  Stats Provider │
│                 │  │                 │  │   Abstraction   │
│  ┌───────────┐  │  │  ┌───────────┐  │  │                 │
│  │   Users   │  │  │  │  Sessions │  │  │  ┌───────────┐  │
│  │  Leagues  │  │  │  │  Job Queue│  │  │  │ CDL API   │  │
│  │  Players  │  │  │  │  Cache    │  │  │  │ (Primary) │  │
│  │  Matches  │  │  │  └───────────┘  │  │  └───────────┘  │
│  │  Lineups  │  │  │                 │  │  ┌───────────┐  │
│  │  Stats    │  │  │                 │  │  │ Scraper   │  │
│  └───────────┘  │  │                 │  │  │ (Fallback)│  │
│                 │  │                 │  │  └───────────┘  │
└─────────────────┘  └────────┬────────┘  │  ┌───────────┐  │
                              │           │  │ Demo Data │  │
                              │           │  │ (Dev)     │  │
                              │           │  └───────────┘  │
                              │           └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKGROUND WORKERS                                │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    BullMQ Job Processor                         │   │
│   │                                                                  │   │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │   │
│   │  │  Sync Schedule  │  │  Ingest Stats   │  │ Compute Scores  │ │   │
│   │  │  (Every 6 hrs)  │  │  (Every 30 min) │  │ (On match end)  │ │   │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │   │
│   │                                                                  │   │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │   │
│   │  │ Update Standings│  │  Lock Lineups   │  │  Auto-Draft     │ │   │
│   │  │ (After matches) │  │  (At period    │  │  Pick Processor │ │   │
│   │  │                 │  │   lock time)    │  │                 │ │   │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │   │
│   │                                                                  │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Match Stats → Fantasy Points

```
1. SCHEDULE SYNC (every 6 hours)
   ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
   │  Stats Provider│────▶│  Parse & Map   │────▶│  Upsert Matches│
   │  fetch schedule│     │  to our schema │     │  & Periods     │
   └────────────────┘     └────────────────┘     └────────────────┘

2. STATS INGESTION (every 30 minutes, or on-demand)
   ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
   │  Stats Provider│────▶│  Find completed│────▶│  Fetch player  │
   │  check matches │     │  matches       │     │  stat lines    │
   └────────────────┘     └────────────────┘     └────────────────┘
                                                          │
                                                          ▼
   ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
   │  Store raw     │◀────│  Validate &    │◀────│  Parse stats   │
   │  PlayerStatLine│     │  dedupe        │     │  JSON/HTML     │
   └────────────────┘     └────────────────┘     └────────────────┘

3. SCORING COMPUTATION (after stats ingested)
   ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
   │  Load stat line│────▶│  Apply scoring │────▶│  Store Fantasy │
   │  for player    │     │  rules         │     │  Points record │
   └────────────────┘     └────────────────┘     └────────────────┘
                                                          │
                                                          ▼
   ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
   │  Update league │◀────│  Sum starters' │◀────│  Get active    │
   │  standings     │     │  points        │     │  lineup slots  │
   └────────────────┘     └────────────────┘     └────────────────┘
```

---

## Key Design Decisions

### 1. Idempotent Jobs
All background jobs use composite keys for upserts:
- `PlayerStatLine`: unique on `(playerId, matchId, mapNumber)`
- `FantasyPoints`: unique on `(playerStatLineId, leagueId)`
- `Matchup`: unique on `(scoringPeriodId, fantasyTeam1Id, fantasyTeam2Id)`

### 2. Separation of Raw Stats vs Fantasy Points
- `PlayerStatLine` stores raw stats exactly as received (kills, deaths, damage, etc.)
- `FantasyPoints` computed separately, linked back to stat line
- Allows re-scoring if rules change without re-fetching data

### 3. Stats Provider Abstraction
```typescript
interface StatsProvider {
  getSchedule(season: string): Promise<CDLMatch[]>;
  getMatchStats(matchId: string): Promise<PlayerStatLine[]>;
  getPlayers(): Promise<CDLPlayer[]>;
  getTeams(): Promise<CDLTeam[]>;
}
```
Implementations:
- `CDLApiProvider` - Official API (if available)
- `BreakingPointProvider` - breakingpoint.gg scraper
- `DemoProvider` - Fake data for development

### 4. Lineup Lock Strategy
- Period-level locks (not per-match)
- `ScoringPeriod.lockTime` determines when lineups become immutable
- Background job checks and sets `locked: true` on lineups at lock time
- Simple to understand and implement for MVP

### 5. Draft Implementation
- Real-time via WebSocket (Socket.io)
- Timer per pick with configurable duration
- Auto-pick on timeout (best available by ADP)
- Draft state stored in DB, recoverable if server restarts

---

## Scoring Rules (Default)

| Stat | Points |
|------|--------|
| Kill | +1.0 |
| Death | -0.5 |
| Assist | +0.25 |
| Objective (HP time, Hardpoint seconds) | +0.02 per second |
| Bomb Plant (S&D) | +2.0 |
| Bomb Defuse (S&D) | +2.0 |
| First Blood (S&D) | +1.5 |
| Ace (5 kills in S&D round) | +3.0 |
| 3-piece (3 rapid kills) | +1.0 |

---

## API Authentication

- JWT tokens with 7-day expiry
- Refresh token rotation
- Passwords hashed with bcrypt (cost factor 12)
- Rate limiting: 100 req/min per IP for auth routes

---

## Limitations & Future Improvements

### MVP Limitations
1. **No live scoring** - Updates after matches complete (30-min polling)
2. **Web-only** - No native mobile app (responsive web works on mobile)
3. **Basic draft UI** - Functional but not polished
4. **Limited stats** - Depends on data source availability
5. **No trades** - Players can only be dropped/added via waivers

### Future Improvements
1. Live scoring via WebSocket when matches are in progress
2. React Native mobile apps
3. Trade system with league voting
4. Advanced analytics and projections
5. Multiple sport support (other esports)
6. Premium data provider integration
