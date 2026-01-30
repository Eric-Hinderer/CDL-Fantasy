// Stats Provider Abstraction
// Allows swapping data sources (API, scraper, demo data)

export interface CDLTeamData {
  externalId: string;
  name: string;
  abbreviation: string;
  logoUrl?: string;
  primaryColor?: string;
}

export interface CDLPlayerData {
  externalId: string;
  gamerTag: string;
  realName?: string;
  photoUrl?: string;
  role?: string;
  country?: string;
  teamExternalId?: string;
  averageDraftPosition?: number;
}

export interface CDLMatchData {
  externalId: string;
  scheduledAt: Date;
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  homeScore?: number;
  awayScore?: number;
  winnerExternalId?: string;
}

export interface PlayerStatLineData {
  playerExternalId: string;
  matchExternalId: string;
  mapNumber?: number;
  gameMode?: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  objectiveTime: number;
  bombPlants: number;
  bombDefuses: number;
  firstBloods: number;
}

export interface StatsProvider {
  name: string;

  // Get all CDL teams
  getTeams(): Promise<CDLTeamData[]>;

  // Get all CDL players
  getPlayers(): Promise<CDLPlayerData[]>;

  // Get schedule for a date range
  getSchedule(startDate: Date, endDate: Date): Promise<CDLMatchData[]>;

  // Get match result and player stats
  getMatchStats(matchExternalId: string): Promise<PlayerStatLineData[]>;

  // Check if a match has completed stats available
  isMatchComplete(matchExternalId: string): Promise<boolean>;
}

// Factory function to get the configured provider
export function getStatsProvider(providerName: string): StatsProvider {
  switch (providerName) {
    case 'demo':
      // Lazy import to avoid circular dependencies
      return new (require('./demoProvider').DemoProvider)();
    case 'breakingpoint':
      return new (require('./breakingPointProvider').BreakingPointProvider)();
    case 'cdl-api':
      // Future: implement official CDL API if available
      throw new Error('CDL API provider not yet implemented');
    default:
      throw new Error(`Unknown stats provider: ${providerName}`);
  }
}
