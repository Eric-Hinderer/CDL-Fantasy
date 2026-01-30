import {
  StatsProvider,
  CDLTeamData,
  CDLPlayerData,
  CDLMatchData,
  PlayerStatLineData,
} from './statsProvider.js';

// Demo data provider for development and testing
// Provides realistic-looking fake data for the 2024 CDL season

const DEMO_TEAMS: CDLTeamData[] = [
  { externalId: 'atl', name: 'Atlanta FaZe', abbreviation: 'ATL', primaryColor: '#E43D30' },
  { externalId: 'bos', name: 'Boston Breach', abbreviation: 'BOS', primaryColor: '#1B9F4B' },
  { externalId: 'car', name: 'Carolina Royal Ravens', abbreviation: 'CAR', primaryColor: '#2A2A72' },
  { externalId: 'lav', name: 'Las Vegas Legion', abbreviation: 'LAV', primaryColor: '#EF3E42' },
  { externalId: 'lat', name: 'LA Thieves', abbreviation: 'LAT', primaryColor: '#FF0000' },
  { externalId: 'mia', name: 'Miami Heretics', abbreviation: 'MIA', primaryColor: '#00BFB2' },
  { externalId: 'min', name: 'Minnesota ROKKR', abbreviation: 'MIN', primaryColor: '#351F67' },
  { externalId: 'nysl', name: 'New York Subliners', abbreviation: 'NYSL', primaryColor: '#171C38' },
  { externalId: 'opr', name: 'OpTic Texas', abbreviation: 'OPR', primaryColor: '#92C83E' },
  { externalId: 'sea', name: 'Seattle Surge', abbreviation: 'SEA', primaryColor: '#00B2A9' },
  { externalId: 'tor', name: 'Toronto Ultra', abbreviation: 'TOR', primaryColor: '#773DBE' },
  { externalId: 'lac', name: 'Los Angeles Guerrillas', abbreviation: 'LAG', primaryColor: '#60269E' },
];

const DEMO_PLAYERS: CDLPlayerData[] = [
  // Atlanta FaZe
  { externalId: 'simp', gamerTag: 'Simp', realName: 'Chris Lehr', role: 'SMG', teamExternalId: 'atl', averageDraftPosition: 1 },
  { externalId: 'abezy', gamerTag: 'aBeZy', realName: 'Tyler Pharris', role: 'SMG', teamExternalId: 'atl', averageDraftPosition: 2 },
  { externalId: 'cellium', gamerTag: 'Cellium', realName: 'McArthur Jovel', role: 'AR', teamExternalId: 'atl', averageDraftPosition: 3 },
  { externalId: 'drazah', gamerTag: 'Drazah', realName: 'Zack Jordan', role: 'Flex', teamExternalId: 'atl', averageDraftPosition: 8 },

  // OpTic Texas
  { externalId: 'shotzzy', gamerTag: 'Shotzzy', realName: 'Anthony Cuevas-Castro', role: 'SMG', teamExternalId: 'opr', averageDraftPosition: 4 },
  { externalId: 'dashy', gamerTag: 'Dashy', realName: 'Brandon Otell', role: 'AR', teamExternalId: 'opr', averageDraftPosition: 5 },
  { externalId: 'kenny', gamerTag: 'Kenny', realName: 'Kenneth Williams', role: 'AR', teamExternalId: 'opr', averageDraftPosition: 9 },
  { externalId: 'pred', gamerTag: 'Pred', realName: 'Eli Nissan', role: 'SMG', teamExternalId: 'opr', averageDraftPosition: 12 },

  // New York Subliners
  { externalId: 'hydra', gamerTag: 'HyDra', realName: 'Paco Rusiewiez', role: 'SMG', teamExternalId: 'nysl', averageDraftPosition: 6 },
  { externalId: 'kismet', gamerTag: 'Kismet', realName: 'Matthew Tinsley', role: 'Flex', teamExternalId: 'nysl', averageDraftPosition: 15 },
  { externalId: 'crimsix', gamerTag: 'Crimsix', realName: 'Ian Porter', role: 'AR', teamExternalId: 'nysl', averageDraftPosition: 20 },
  { externalId: 'nero', gamerTag: 'Nero', realName: 'Nicholas Grillo', role: 'SMG', teamExternalId: 'nysl', averageDraftPosition: 25 },

  // LA Thieves
  { externalId: 'envoy', gamerTag: 'Envoy', realName: 'Dylan Hannon', role: 'SMG', teamExternalId: 'lat', averageDraftPosition: 7 },
  { externalId: 'octane', gamerTag: 'Octane', realName: 'Sam Larew', role: 'AR', teamExternalId: 'lat', averageDraftPosition: 14 },
  { externalId: 'ghosty', gamerTag: 'Ghosty', realName: 'Marcus Gomez', role: 'SMG', teamExternalId: 'lat', averageDraftPosition: 22 },
  { externalId: 'fame', gamerTag: 'Fame', realName: 'Nicky Brice', role: 'Flex', teamExternalId: 'lat', averageDraftPosition: 28 },

  // Toronto Ultra
  { externalId: 'cleanx', gamerTag: 'CleanX', realName: 'Tobias Juul Jönsson', role: 'SMG', teamExternalId: 'tor', averageDraftPosition: 10 },
  { externalId: 'insight', gamerTag: 'Insight', realName: 'Jamie Craven', role: 'AR', teamExternalId: 'tor', averageDraftPosition: 11 },
  { externalId: 'scrap', gamerTag: 'Scrap', realName: 'Evan Lanning', role: 'Flex', teamExternalId: 'tor', averageDraftPosition: 23 },
  { externalId: 'bance', gamerTag: 'Bance', realName: 'Ben Bance', role: 'SMG', teamExternalId: 'tor', averageDraftPosition: 30 },

  // Seattle Surge
  { externalId: 'sib', gamerTag: 'Sib', realName: 'Branden Aponte', role: 'SMG', teamExternalId: 'sea', averageDraftPosition: 13 },
  { externalId: 'skyz', gamerTag: 'Skyz', realName: 'César Bueno', role: 'AR', teamExternalId: 'sea', averageDraftPosition: 16 },
  { externalId: 'mack', gamerTag: 'Mack', realName: 'Makenzie Kelley', role: 'Flex', teamExternalId: 'sea', averageDraftPosition: 24 },
  { externalId: 'snoopy', gamerTag: 'Snoopy', realName: 'Elijah Czoski', role: 'SMG', teamExternalId: 'sea', averageDraftPosition: 32 },

  // Minnesota ROKKR
  { externalId: 'attach', gamerTag: 'Attach', realName: 'Dillon Price', role: 'Flex', teamExternalId: 'min', averageDraftPosition: 17 },
  { externalId: 'accuracy', gamerTag: 'Accuracy', realName: 'Lamar Abedi', role: 'AR', teamExternalId: 'min', averageDraftPosition: 26 },
  { externalId: 'standy', gamerTag: 'Standy', realName: 'Austin Stanley', role: 'SMG', teamExternalId: 'min', averageDraftPosition: 18 },
  { externalId: 'havok', gamerTag: 'Havok', realName: 'Dylan Hardy', role: 'SMG', teamExternalId: 'min', averageDraftPosition: 35 },

  // Boston Breach
  { externalId: 'capsidal', gamerTag: 'Capsidal', realName: 'Anthony Luu', role: 'AR', teamExternalId: 'bos', averageDraftPosition: 19 },
  { externalId: 'owakening', gamerTag: 'Owakening', realName: 'Jordan Howes', role: 'SMG', teamExternalId: 'bos', averageDraftPosition: 21 },
  { externalId: 'beans', gamerTag: 'Beans', realName: 'Obada Zaytoun', role: 'SMG', teamExternalId: 'bos', averageDraftPosition: 34 },
  { externalId: 'knight', gamerTag: 'Knight', realName: 'Zemil Knight', role: 'Flex', teamExternalId: 'bos', averageDraftPosition: 40 },

  // Additional players for other teams to fill rosters
  { externalId: 'clay', gamerTag: 'Clayster', realName: 'James Eubanks', role: 'AR', teamExternalId: 'car', averageDraftPosition: 27 },
  { externalId: 'vivid', gamerTag: 'Vivid', realName: 'Vincent Stahl', role: 'SMG', teamExternalId: 'car', averageDraftPosition: 29 },
  { externalId: 'pentagrxm', gamerTag: 'Pentagrxm', realName: 'Tamara Yacoub', role: 'SMG', teamExternalId: 'car', averageDraftPosition: 36 },
  { externalId: 'zer0', gamerTag: 'Zer0', realName: 'Rhys Maybury', role: 'Flex', teamExternalId: 'car', averageDraftPosition: 42 },

  { externalId: 'slasher', gamerTag: 'Slasher', realName: 'Austin Liddicoat', role: 'AR', teamExternalId: 'lav', averageDraftPosition: 31 },
  { externalId: 'asim', gamerTag: 'Asim', realName: 'Asim Sloss', role: 'SMG', teamExternalId: 'lav', averageDraftPosition: 33 },
  { externalId: 'fame_lav', gamerTag: 'TJHaly', realName: 'TJ Haly', role: 'SMG', teamExternalId: 'lav', averageDraftPosition: 37 },
  { externalId: 'diamondcon', gamerTag: 'DiamondCon', realName: 'Connor Johst', role: 'AR', teamExternalId: 'lav', averageDraftPosition: 43 },

  { externalId: 'venom', gamerTag: 'Venom', realName: 'David Ontiveros', role: 'SMG', teamExternalId: 'mia', averageDraftPosition: 38 },
  { externalId: 'lucky', gamerTag: 'Lucky', realName: 'Luis Candelario', role: 'SMG', teamExternalId: 'mia', averageDraftPosition: 39 },
  { externalId: 'kremp', gamerTag: 'Kremp', realName: 'Kevin Rampino', role: 'AR', teamExternalId: 'mia', averageDraftPosition: 41 },
  { externalId: 'vikul', gamerTag: 'Vikul', realName: 'Viktor Kaup', role: 'Flex', teamExternalId: 'mia', averageDraftPosition: 44 },

  { externalId: 'huke', gamerTag: 'Huke', realName: 'Cuyler Garland', role: 'SMG', teamExternalId: 'lac', averageDraftPosition: 45 },
  { externalId: 'arcitys', gamerTag: 'Arcitys', realName: 'Alec Sanderson', role: 'AR', teamExternalId: 'lac', averageDraftPosition: 46 },
  { externalId: 'cheen', gamerTag: 'Cheen', realName: 'Alejandro Mena', role: 'SMG', teamExternalId: 'lac', averageDraftPosition: 47 },
  { externalId: 'estreal', gamerTag: 'Estreal', realName: 'Joshua Gutierrez', role: 'Flex', teamExternalId: 'lac', averageDraftPosition: 48 },
];

// Generate demo schedule
function generateDemoSchedule(startDate: Date, endDate: Date): CDLMatchData[] {
  const matches: CDLMatchData[] = [];
  const teams = DEMO_TEAMS.map((t) => t.externalId);

  // Generate matches for each week
  let matchId = 1;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Shuffle teams for this week's matchups
    const shuffled = [...teams].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        const matchDate = new Date(currentDate);
        matchDate.setHours(14 + Math.floor(i / 2) * 2); // Stagger match times

        const isCompleted = matchDate < new Date();
        const homeScore = isCompleted ? Math.floor(Math.random() * 3) + 1 : undefined;
        const awayScore = isCompleted ? Math.floor(Math.random() * 3) + 1 : undefined;

        matches.push({
          externalId: `match-${matchId++}`,
          scheduledAt: matchDate,
          homeTeamExternalId: shuffled[i],
          awayTeamExternalId: shuffled[i + 1],
          status: isCompleted ? 'COMPLETED' : 'SCHEDULED',
          homeScore,
          awayScore,
          winnerExternalId:
            isCompleted && homeScore !== undefined && awayScore !== undefined
              ? homeScore > awayScore
                ? shuffled[i]
                : shuffled[i + 1]
              : undefined,
        });
      }
    }

    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return matches;
}

// Generate random realistic stats
function generateRandomStats(): Omit<PlayerStatLineData, 'playerExternalId' | 'matchExternalId'> {
  const isGoodGame = Math.random() > 0.3;
  const baseKills = isGoodGame ? 25 : 18;
  const baseDeaths = isGoodGame ? 20 : 24;

  return {
    kills: Math.floor(baseKills + (Math.random() - 0.5) * 15),
    deaths: Math.floor(baseDeaths + (Math.random() - 0.5) * 10),
    assists: Math.floor(Math.random() * 8),
    damage: Math.floor(3000 + Math.random() * 2000),
    objectiveTime: Math.floor(Math.random() * 120),
    bombPlants: Math.floor(Math.random() * 3),
    bombDefuses: Math.floor(Math.random() * 2),
    firstBloods: Math.floor(Math.random() * 4),
    mapNumber: 1,
    gameMode: ['Hardpoint', 'Search & Destroy', 'Control'][Math.floor(Math.random() * 3)],
  };
}

export class DemoProvider implements StatsProvider {
  name = 'demo';

  private scheduleCache: CDLMatchData[] | null = null;

  async getTeams(): Promise<CDLTeamData[]> {
    return DEMO_TEAMS;
  }

  async getPlayers(): Promise<CDLPlayerData[]> {
    return DEMO_PLAYERS;
  }

  async getSchedule(startDate: Date, endDate: Date): Promise<CDLMatchData[]> {
    if (!this.scheduleCache) {
      // Generate schedule for a full season
      const seasonStart = new Date();
      seasonStart.setMonth(seasonStart.getMonth() - 2);
      const seasonEnd = new Date();
      seasonEnd.setMonth(seasonEnd.getMonth() + 4);
      this.scheduleCache = generateDemoSchedule(seasonStart, seasonEnd);
    }

    return this.scheduleCache.filter(
      (m) => m.scheduledAt >= startDate && m.scheduledAt <= endDate
    );
  }

  async getMatchStats(matchExternalId: string): Promise<PlayerStatLineData[]> {
    // Get match to find participating teams
    if (!this.scheduleCache) {
      await this.getSchedule(new Date(0), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
    }

    const match = this.scheduleCache?.find((m) => m.externalId === matchExternalId);
    if (!match || match.status !== 'COMPLETED') {
      return [];
    }

    // Get players from both teams
    const teamPlayers = DEMO_PLAYERS.filter(
      (p) =>
        p.teamExternalId === match.homeTeamExternalId ||
        p.teamExternalId === match.awayTeamExternalId
    );

    // Generate stats for each player across 3-5 maps
    const numMaps = 3 + Math.floor(Math.random() * 3);
    const stats: PlayerStatLineData[] = [];

    for (const player of teamPlayers) {
      for (let map = 1; map <= numMaps; map++) {
        stats.push({
          playerExternalId: player.externalId,
          matchExternalId,
          mapNumber: map,
          ...generateRandomStats(),
        });
      }
    }

    return stats;
  }

  async isMatchComplete(matchExternalId: string): Promise<boolean> {
    if (!this.scheduleCache) {
      await this.getSchedule(new Date(0), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
    }

    const match = this.scheduleCache?.find((m) => m.externalId === matchExternalId);
    return match?.status === 'COMPLETED';
  }
}
