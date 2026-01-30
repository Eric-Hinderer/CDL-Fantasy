import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Demo CDL Teams
const CDL_TEAMS = [
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

// Demo CDL Players (4 per team)
const CDL_PLAYERS = [
  // Atlanta FaZe
  { externalId: 'simp', gamerTag: 'Simp', role: 'SMG', teamExternalId: 'atl', adp: 1 },
  { externalId: 'abezy', gamerTag: 'aBeZy', role: 'SMG', teamExternalId: 'atl', adp: 2 },
  { externalId: 'cellium', gamerTag: 'Cellium', role: 'AR', teamExternalId: 'atl', adp: 3 },
  { externalId: 'drazah', gamerTag: 'Drazah', role: 'Flex', teamExternalId: 'atl', adp: 8 },
  // OpTic Texas
  { externalId: 'shotzzy', gamerTag: 'Shotzzy', role: 'SMG', teamExternalId: 'opr', adp: 4 },
  { externalId: 'dashy', gamerTag: 'Dashy', role: 'AR', teamExternalId: 'opr', adp: 5 },
  { externalId: 'kenny', gamerTag: 'Kenny', role: 'AR', teamExternalId: 'opr', adp: 9 },
  { externalId: 'pred', gamerTag: 'Pred', role: 'SMG', teamExternalId: 'opr', adp: 12 },
  // New York Subliners
  { externalId: 'hydra', gamerTag: 'HyDra', role: 'SMG', teamExternalId: 'nysl', adp: 6 },
  { externalId: 'kismet', gamerTag: 'Kismet', role: 'Flex', teamExternalId: 'nysl', adp: 15 },
  { externalId: 'crimsix', gamerTag: 'Crimsix', role: 'AR', teamExternalId: 'nysl', adp: 20 },
  { externalId: 'nero', gamerTag: 'Nero', role: 'SMG', teamExternalId: 'nysl', adp: 25 },
  // LA Thieves
  { externalId: 'envoy', gamerTag: 'Envoy', role: 'SMG', teamExternalId: 'lat', adp: 7 },
  { externalId: 'octane', gamerTag: 'Octane', role: 'AR', teamExternalId: 'lat', adp: 14 },
  { externalId: 'ghosty', gamerTag: 'Ghosty', role: 'SMG', teamExternalId: 'lat', adp: 22 },
  { externalId: 'fame', gamerTag: 'Fame', role: 'Flex', teamExternalId: 'lat', adp: 28 },
  // Toronto Ultra
  { externalId: 'cleanx', gamerTag: 'CleanX', role: 'SMG', teamExternalId: 'tor', adp: 10 },
  { externalId: 'insight', gamerTag: 'Insight', role: 'AR', teamExternalId: 'tor', adp: 11 },
  { externalId: 'scrap', gamerTag: 'Scrap', role: 'Flex', teamExternalId: 'tor', adp: 23 },
  { externalId: 'bance', gamerTag: 'Bance', role: 'SMG', teamExternalId: 'tor', adp: 30 },
  // Seattle Surge
  { externalId: 'sib', gamerTag: 'Sib', role: 'SMG', teamExternalId: 'sea', adp: 13 },
  { externalId: 'skyz', gamerTag: 'Skyz', role: 'AR', teamExternalId: 'sea', adp: 16 },
  { externalId: 'mack', gamerTag: 'Mack', role: 'Flex', teamExternalId: 'sea', adp: 24 },
  { externalId: 'snoopy', gamerTag: 'Snoopy', role: 'SMG', teamExternalId: 'sea', adp: 32 },
  // Minnesota ROKKR
  { externalId: 'attach', gamerTag: 'Attach', role: 'Flex', teamExternalId: 'min', adp: 17 },
  { externalId: 'accuracy', gamerTag: 'Accuracy', role: 'AR', teamExternalId: 'min', adp: 26 },
  { externalId: 'standy', gamerTag: 'Standy', role: 'SMG', teamExternalId: 'min', adp: 18 },
  { externalId: 'havok', gamerTag: 'Havok', role: 'SMG', teamExternalId: 'min', adp: 35 },
  // Boston Breach
  { externalId: 'capsidal', gamerTag: 'Capsidal', role: 'AR', teamExternalId: 'bos', adp: 19 },
  { externalId: 'owakening', gamerTag: 'Owakening', role: 'SMG', teamExternalId: 'bos', adp: 21 },
  { externalId: 'beans', gamerTag: 'Beans', role: 'SMG', teamExternalId: 'bos', adp: 34 },
  { externalId: 'knight', gamerTag: 'Knight', role: 'Flex', teamExternalId: 'bos', adp: 40 },
  // Carolina Royal Ravens
  { externalId: 'clayster', gamerTag: 'Clayster', role: 'AR', teamExternalId: 'car', adp: 27 },
  { externalId: 'vivid', gamerTag: 'Vivid', role: 'SMG', teamExternalId: 'car', adp: 29 },
  { externalId: 'pentagrxm', gamerTag: 'Pentagrxm', role: 'SMG', teamExternalId: 'car', adp: 36 },
  { externalId: 'zer0', gamerTag: 'Zer0', role: 'Flex', teamExternalId: 'car', adp: 42 },
  // Las Vegas Legion
  { externalId: 'slasher', gamerTag: 'Slasher', role: 'AR', teamExternalId: 'lav', adp: 31 },
  { externalId: 'asim', gamerTag: 'Asim', role: 'SMG', teamExternalId: 'lav', adp: 33 },
  { externalId: 'tjhaly', gamerTag: 'TJHaly', role: 'SMG', teamExternalId: 'lav', adp: 37 },
  { externalId: 'diamondcon', gamerTag: 'DiamondCon', role: 'AR', teamExternalId: 'lav', adp: 43 },
  // Miami Heretics
  { externalId: 'venom', gamerTag: 'Venom', role: 'SMG', teamExternalId: 'mia', adp: 38 },
  { externalId: 'lucky', gamerTag: 'Lucky', role: 'SMG', teamExternalId: 'mia', adp: 39 },
  { externalId: 'kremp', gamerTag: 'Kremp', role: 'AR', teamExternalId: 'mia', adp: 41 },
  { externalId: 'vikul', gamerTag: 'Vikul', role: 'Flex', teamExternalId: 'mia', adp: 44 },
  // Los Angeles Guerrillas
  { externalId: 'huke', gamerTag: 'Huke', role: 'SMG', teamExternalId: 'lac', adp: 45 },
  { externalId: 'arcitys', gamerTag: 'Arcitys', role: 'AR', teamExternalId: 'lac', adp: 46 },
  { externalId: 'cheen', gamerTag: 'Cheen', role: 'SMG', teamExternalId: 'lac', adp: 47 },
  { externalId: 'estreal', gamerTag: 'Estreal', role: 'Flex', teamExternalId: 'lac', adp: 48 },
];

const DEFAULT_SCORING_RULES = {
  killPoints: 1.0,
  deathPoints: -0.5,
  assistPoints: 0.25,
  damagePoints: 0.01,
  objectiveTimePoints: 0.02,
  bombPlantPoints: 2.0,
  bombDefusePoints: 2.0,
  firstBloodPoints: 1.5,
};

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  await prisma.fantasyPoints.deleteMany();
  await prisma.playerStatLine.deleteMany();
  await prisma.teamTotal.deleteMany();
  await prisma.matchup.deleteMany();
  await prisma.lineupSlot.deleteMany();
  await prisma.lineup.deleteMany();
  await prisma.draftPick.deleteMany();
  await prisma.draftSettings.deleteMany();
  await prisma.rosterSlot.deleteMany();
  await prisma.fantasyTeam.deleteMany();
  await prisma.scoringPeriod.deleteMany();
  await prisma.league.deleteMany();
  await prisma.cdlMatch.deleteMany();
  await prisma.cdlPlayer.deleteMany();
  await prisma.cdlTeam.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data');

  // Create CDL Teams
  const teamMap = new Map<string, string>();
  for (const team of CDL_TEAMS) {
    const created = await prisma.cdlTeam.create({
      data: {
        externalId: team.externalId,
        name: team.name,
        abbreviation: team.abbreviation,
        primaryColor: team.primaryColor,
      },
    });
    teamMap.set(team.externalId, created.id);
  }
  console.log(`Created ${CDL_TEAMS.length} CDL teams`);

  // Create CDL Players
  for (const player of CDL_PLAYERS) {
    await prisma.cdlPlayer.create({
      data: {
        externalId: player.externalId,
        gamerTag: player.gamerTag,
        role: player.role,
        cdlTeamId: teamMap.get(player.teamExternalId),
        averageDraftPosition: player.adp,
        isActive: true,
      },
    });
  }
  console.log(`Created ${CDL_PLAYERS.length} CDL players`);

  // Create some demo matches
  const teams = Array.from(teamMap.entries());
  const now = new Date();

  for (let i = 0; i < 6; i++) {
    const matchDate = new Date(now);
    matchDate.setDate(matchDate.getDate() - 7 + i * 2);

    const homeTeam = teams[i % teams.length];
    const awayTeam = teams[(i + 6) % teams.length];

    const isCompleted = matchDate < now;
    const homeScore = isCompleted ? Math.floor(Math.random() * 3) + 1 : null;
    const awayScore = isCompleted ? Math.floor(Math.random() * 3) + 1 : null;

    await prisma.cdlMatch.create({
      data: {
        externalId: `seed-match-${i + 1}`,
        scheduledAt: matchDate,
        status: isCompleted ? 'COMPLETED' : 'SCHEDULED',
        homeTeamId: homeTeam[1],
        awayTeamId: awayTeam[1],
        homeScore,
        awayScore,
        winnerId: isCompleted && homeScore !== null && awayScore !== null
          ? (homeScore > awayScore ? homeTeam[0] : awayTeam[0])
          : null,
      },
    });
  }
  console.log('Created demo matches');

  // Create demo users
  const passwordHash = await bcrypt.hash('password123', 12);

  const user1 = await prisma.user.create({
    data: {
      email: 'demo@example.com',
      username: 'demo_user',
      displayName: 'Demo User',
      passwordHash,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'player2@example.com',
      username: 'player_two',
      displayName: 'Player Two',
      passwordHash,
    },
  });

  const user3 = await prisma.user.create({
    data: {
      email: 'player3@example.com',
      username: 'player_three',
      displayName: 'Player Three',
      passwordHash,
    },
  });

  const user4 = await prisma.user.create({
    data: {
      email: 'player4@example.com',
      username: 'player_four',
      displayName: 'Player Four',
      passwordHash,
    },
  });

  console.log('Created demo users');

  // Create a demo league
  const league = await prisma.league.create({
    data: {
      name: 'Demo League 2024',
      joinCode: 'DEMO24',
      isPublic: true,
      maxTeams: 8,
      rosterSize: 6,
      starterCount: 4,
      scoringRules: DEFAULT_SCORING_RULES,
      ownerId: user1.id,
      status: 'IN_SEASON',
    },
  });

  console.log('Created demo league');

  // Create fantasy teams for each user
  const team1 = await prisma.fantasyTeam.create({
    data: {
      name: 'FaZe Fanatics',
      userId: user1.id,
      leagueId: league.id,
      wins: 2,
      losses: 1,
      totalPoints: 156.5,
    },
  });

  const team2 = await prisma.fantasyTeam.create({
    data: {
      name: 'OpTic Army',
      userId: user2.id,
      leagueId: league.id,
      wins: 2,
      losses: 1,
      totalPoints: 148.3,
    },
  });

  const team3 = await prisma.fantasyTeam.create({
    data: {
      name: 'Ultra Fans',
      userId: user3.id,
      leagueId: league.id,
      wins: 1,
      losses: 2,
      totalPoints: 135.7,
    },
  });

  const team4 = await prisma.fantasyTeam.create({
    data: {
      name: 'Surge Squad',
      userId: user4.id,
      leagueId: league.id,
      wins: 1,
      losses: 2,
      totalPoints: 122.4,
    },
  });

  console.log('Created fantasy teams');

  // Assign players to rosters (draft results)
  const allPlayers = await prisma.cdlPlayer.findMany({
    orderBy: { averageDraftPosition: 'asc' },
  });

  const teamPlayers = [
    [allPlayers[0], allPlayers[7], allPlayers[8], allPlayers[15], allPlayers[16], allPlayers[23]], // Team 1
    [allPlayers[1], allPlayers[6], allPlayers[9], allPlayers[14], allPlayers[17], allPlayers[22]], // Team 2
    [allPlayers[2], allPlayers[5], allPlayers[10], allPlayers[13], allPlayers[18], allPlayers[21]], // Team 3
    [allPlayers[3], allPlayers[4], allPlayers[11], allPlayers[12], allPlayers[19], allPlayers[20]], // Team 4
  ];

  const teams = [team1, team2, team3, team4];

  for (let i = 0; i < teams.length; i++) {
    for (const player of teamPlayers[i]) {
      await prisma.rosterSlot.create({
        data: {
          fantasyTeamId: teams[i].id,
          playerId: player.id,
        },
      });
    }
  }

  console.log('Assigned players to rosters');

  // Create draft settings (marked as completed)
  await prisma.draftSettings.create({
    data: {
      leagueId: league.id,
      draftOrder: [team1.id, team2.id, team3.id, team4.id],
      secondsPerPick: 60,
      status: 'COMPLETED',
      currentPick: 24,
      currentRound: 6,
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 3600000),
    },
  });

  // Create scoring periods
  const period1Start = new Date();
  period1Start.setDate(period1Start.getDate() - 7);
  const period1End = new Date();
  period1End.setDate(period1End.getDate() - 1);
  const period1Lock = new Date(period1Start);

  const period1 = await prisma.scoringPeriod.create({
    data: {
      name: 'Qualifier Week 1',
      leagueId: league.id,
      startDate: period1Start,
      endDate: period1End,
      lockTime: period1Lock,
      periodType: 'QUALIFIER_WEEK',
      isActive: false,
      isCompleted: true,
    },
  });

  const period2Start = new Date();
  const period2End = new Date();
  period2End.setDate(period2End.getDate() + 6);
  const period2Lock = new Date(period2Start);
  period2Lock.setHours(period2Lock.getHours() + 2);

  const period2 = await prisma.scoringPeriod.create({
    data: {
      name: 'Qualifier Week 2',
      leagueId: league.id,
      startDate: period2Start,
      endDate: period2End,
      lockTime: period2Lock,
      periodType: 'QUALIFIER_WEEK',
      isActive: true,
      isCompleted: false,
    },
  });

  console.log('Created scoring periods');

  // Create matchups for period 1 (completed)
  await prisma.matchup.create({
    data: {
      scoringPeriodId: period1.id,
      team1Id: team1.id,
      team2Id: team4.id,
      team1Score: 52.5,
      team2Score: 45.2,
      winnerId: team1.id,
      isCompleted: true,
    },
  });

  await prisma.matchup.create({
    data: {
      scoringPeriodId: period1.id,
      team1Id: team2.id,
      team2Id: team3.id,
      team1Score: 48.3,
      team2Score: 51.7,
      winnerId: team3.id,
      isCompleted: true,
    },
  });

  // Create matchups for period 2 (in progress)
  await prisma.matchup.create({
    data: {
      scoringPeriodId: period2.id,
      team1Id: team1.id,
      team2Id: team3.id,
      isCompleted: false,
    },
  });

  await prisma.matchup.create({
    data: {
      scoringPeriodId: period2.id,
      team1Id: team2.id,
      team2Id: team4.id,
      isCompleted: false,
    },
  });

  console.log('Created matchups');

  // Create lineups for current period
  for (let i = 0; i < teams.length; i++) {
    const rosterSlots = await prisma.rosterSlot.findMany({
      where: { fantasyTeamId: teams[i].id },
    });

    const lineup = await prisma.lineup.create({
      data: {
        fantasyTeamId: teams[i].id,
        scoringPeriodId: period2.id,
        isLocked: false,
      },
    });

    // Set first 4 as starters
    for (let j = 0; j < rosterSlots.length; j++) {
      await prisma.lineupSlot.create({
        data: {
          lineupId: lineup.id,
          rosterSlotId: rosterSlots[j].id,
          position: j,
          isStarter: j < 4,
        },
      });
    }
  }

  console.log('Created lineups');

  console.log('✅ Seed completed successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('   Email: demo@example.com');
  console.log('   Password: password123');
  console.log('   League Code: DEMO24');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
