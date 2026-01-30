import { prisma } from '../lib/prisma.js';

// Generate a unique 6-character join code
export async function generateJoinCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');

    const existing = await prisma.league.findUnique({
      where: { joinCode: code },
    });

    if (!existing) {
      return code;
    }

    attempts++;
  } while (attempts < maxAttempts);

  throw new Error('Failed to generate unique join code');
}

// Generate round-robin matchups for a scoring period
export async function generateMatchups(
  scoringPeriodId: string,
  teamIds: string[]
): Promise<void> {
  if (teamIds.length < 2) {
    throw new Error('Need at least 2 teams to generate matchups');
  }

  // For odd number of teams, add a "bye" placeholder
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) {
    teams.push('BYE');
  }

  const numTeams = teams.length;
  const matchups: { team1Id: string; team2Id: string }[] = [];

  // Round-robin algorithm
  // For a single period, we just pair up teams
  // For a full season, we'd rotate through all combinations

  // Simple pairing for MVP: pair teams by position
  for (let i = 0; i < numTeams / 2; i++) {
    const team1 = teams[i];
    const team2 = teams[numTeams - 1 - i];

    if (team1 !== 'BYE' && team2 !== 'BYE') {
      matchups.push({ team1Id: team1, team2Id: team2 });
    }
  }

  // Create matchups in database (idempotent with unique constraint)
  for (const matchup of matchups) {
    await prisma.matchup.upsert({
      where: {
        scoringPeriodId_team1Id_team2Id: {
          scoringPeriodId,
          team1Id: matchup.team1Id,
          team2Id: matchup.team2Id,
        },
      },
      create: {
        scoringPeriodId,
        team1Id: matchup.team1Id,
        team2Id: matchup.team2Id,
      },
      update: {}, // No update needed if exists
    });
  }
}

// Generate matchups for entire season using round-robin
export async function generateSeasonSchedule(leagueId: string): Promise<void> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      fantasyTeams: true,
      scoringPeriods: {
        orderBy: { startDate: 'asc' },
      },
    },
  });

  if (!league) {
    throw new Error('League not found');
  }

  const teams = league.fantasyTeams.map((t) => t.id);
  const periods = league.scoringPeriods;

  if (teams.length < 2 || periods.length === 0) {
    throw new Error('Need at least 2 teams and 1 scoring period');
  }

  // Generate all possible matchup combinations
  const allMatchups: { team1Id: string; team2Id: string }[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      allMatchups.push({ team1Id: teams[i], team2Id: teams[j] });
    }
  }

  // Shuffle matchups
  for (let i = allMatchups.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allMatchups[i], allMatchups[j]] = [allMatchups[j], allMatchups[i]];
  }

  // Distribute matchups across periods
  let matchupIndex = 0;
  const matchupsPerPeriod = Math.ceil(teams.length / 2);

  for (const period of periods) {
    const periodMatchups = [];

    // Try to give each team one matchup per period
    const teamsWithMatchup = new Set<string>();

    for (let i = 0; i < allMatchups.length && periodMatchups.length < matchupsPerPeriod; i++) {
      const idx = (matchupIndex + i) % allMatchups.length;
      const matchup = allMatchups[idx];

      if (!teamsWithMatchup.has(matchup.team1Id) && !teamsWithMatchup.has(matchup.team2Id)) {
        periodMatchups.push(matchup);
        teamsWithMatchup.add(matchup.team1Id);
        teamsWithMatchup.add(matchup.team2Id);
      }
    }

    matchupIndex += periodMatchups.length;

    // Create matchups
    for (const matchup of periodMatchups) {
      await prisma.matchup.upsert({
        where: {
          scoringPeriodId_team1Id_team2Id: {
            scoringPeriodId: period.id,
            team1Id: matchup.team1Id,
            team2Id: matchup.team2Id,
          },
        },
        create: {
          scoringPeriodId: period.id,
          team1Id: matchup.team1Id,
          team2Id: matchup.team2Id,
        },
        update: {},
      });
    }
  }
}
