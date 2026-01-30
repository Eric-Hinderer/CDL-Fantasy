import { prisma } from '../lib/prisma.js';
import { ScoringRules, DEFAULT_SCORING_RULES } from '../config/index.js';

interface PlayerStatLineData {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  objectiveTime: number;
  bombPlants: number;
  bombDefuses: number;
  firstBloods: number;
}

interface PointsBreakdown {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  objectiveTime: number;
  bombPlants: number;
  bombDefuses: number;
  firstBloods: number;
  total: number;
}

// Calculate fantasy points for a stat line using league scoring rules
export function calculateFantasyPoints(
  stats: PlayerStatLineData,
  rules: ScoringRules = DEFAULT_SCORING_RULES
): PointsBreakdown {
  const breakdown: PointsBreakdown = {
    kills: stats.kills * rules.killPoints,
    deaths: stats.deaths * rules.deathPoints,
    assists: stats.assists * rules.assistPoints,
    damage: (stats.damage / 100) * rules.damagePoints,
    objectiveTime: stats.objectiveTime * rules.objectiveTimePoints,
    bombPlants: stats.bombPlants * rules.bombPlantPoints,
    bombDefuses: stats.bombDefuses * rules.bombDefusePoints,
    firstBloods: stats.firstBloods * rules.firstBloodPoints,
    total: 0,
  };

  breakdown.total =
    breakdown.kills +
    breakdown.deaths +
    breakdown.assists +
    breakdown.damage +
    breakdown.objectiveTime +
    breakdown.bombPlants +
    breakdown.bombDefuses +
    breakdown.firstBloods;

  return breakdown;
}

// Compute and store fantasy points for a match
export async function computeMatchFantasyPoints(
  matchId: string,
  leagueId: string
): Promise<void> {
  // Get league scoring rules
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { scoringRules: true },
  });

  if (!league) {
    throw new Error('League not found');
  }

  const rules = league.scoringRules as unknown as ScoringRules;

  // Get all stat lines for this match
  const statLines = await prisma.playerStatLine.findMany({
    where: { matchId },
  });

  // Compute and upsert fantasy points for each stat line
  for (const statLine of statLines) {
    const breakdown = calculateFantasyPoints(statLine, rules);

    await prisma.fantasyPoints.upsert({
      where: {
        statLineId_leagueId: {
          statLineId: statLine.id,
          leagueId,
        },
      },
      create: {
        statLineId: statLine.id,
        leagueId,
        points: breakdown.total,
        breakdown: breakdown as any,
      },
      update: {
        points: breakdown.total,
        breakdown: breakdown as any,
      },
    });
  }
}

// Update team totals for a scoring period
export async function updateTeamTotals(
  leagueId: string,
  scoringPeriodId: string
): Promise<void> {
  // Get all fantasy teams in the league
  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
  });

  for (const team of teams) {
    // Get the lineup for this team and period
    const lineup = await prisma.lineup.findUnique({
      where: {
        fantasyTeamId_scoringPeriodId: {
          fantasyTeamId: team.id,
          scoringPeriodId,
        },
      },
      include: {
        slots: {
          include: {
            rosterSlot: {
              include: {
                player: {
                  include: {
                    statLines: {
                      where: {
                        match: {
                          scoringPeriodId,
                        },
                      },
                      include: {
                        fantasyPoints: {
                          where: { leagueId },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lineup) {
      // No lineup set, use 0 points
      await upsertTeamTotal(team.id, scoringPeriodId, 0, 0);
      continue;
    }

    // Calculate points for starters and bench
    let starterPoints = 0;
    let benchPoints = 0;

    for (const slot of lineup.slots) {
      const playerPoints = slot.rosterSlot.player.statLines.reduce(
        (sum, statLine) => {
          const fp = statLine.fantasyPoints[0];
          return sum + (fp?.points || 0);
        },
        0
      );

      if (slot.isStarter) {
        starterPoints += playerPoints;
      } else {
        benchPoints += playerPoints;
      }
    }

    await upsertTeamTotal(team.id, scoringPeriodId, starterPoints, benchPoints);
  }
}

async function upsertTeamTotal(
  fantasyTeamId: string,
  scoringPeriodId: string,
  starterPoints: number,
  benchPoints: number
): Promise<void> {
  await prisma.teamTotal.upsert({
    where: {
      fantasyTeamId_scoringPeriodId: {
        fantasyTeamId,
        scoringPeriodId,
      },
    },
    create: {
      fantasyTeamId,
      scoringPeriodId,
      starterPoints,
      benchPoints,
      totalPoints: starterPoints + benchPoints,
    },
    update: {
      starterPoints,
      benchPoints,
      totalPoints: starterPoints + benchPoints,
    },
  });
}

// Resolve matchups for a scoring period
export async function resolveMatchups(scoringPeriodId: string): Promise<void> {
  const matchups = await prisma.matchup.findMany({
    where: {
      scoringPeriodId,
      isCompleted: false,
    },
    include: {
      scoringPeriod: {
        include: {
          league: true,
        },
      },
    },
  });

  for (const matchup of matchups) {
    // Get team totals
    const [team1Total, team2Total] = await Promise.all([
      prisma.teamTotal.findUnique({
        where: {
          fantasyTeamId_scoringPeriodId: {
            fantasyTeamId: matchup.team1Id,
            scoringPeriodId,
          },
        },
      }),
      prisma.teamTotal.findUnique({
        where: {
          fantasyTeamId_scoringPeriodId: {
            fantasyTeamId: matchup.team2Id,
            scoringPeriodId,
          },
        },
      }),
    ]);

    const team1Score = team1Total?.starterPoints || 0;
    const team2Score = team2Total?.starterPoints || 0;

    let winnerId: string | null = null;
    if (team1Score > team2Score) {
      winnerId = matchup.team1Id;
    } else if (team2Score > team1Score) {
      winnerId = matchup.team2Id;
    }
    // If equal, winnerId stays null (tie)

    // Update matchup
    await prisma.matchup.update({
      where: { id: matchup.id },
      data: {
        team1Score,
        team2Score,
        winnerId,
        isCompleted: true,
      },
    });

    // Update team records
    if (winnerId === matchup.team1Id) {
      await prisma.$transaction([
        prisma.fantasyTeam.update({
          where: { id: matchup.team1Id },
          data: { wins: { increment: 1 } },
        }),
        prisma.fantasyTeam.update({
          where: { id: matchup.team2Id },
          data: { losses: { increment: 1 } },
        }),
      ]);
    } else if (winnerId === matchup.team2Id) {
      await prisma.$transaction([
        prisma.fantasyTeam.update({
          where: { id: matchup.team1Id },
          data: { losses: { increment: 1 } },
        }),
        prisma.fantasyTeam.update({
          where: { id: matchup.team2Id },
          data: { wins: { increment: 1 } },
        }),
      ]);
    } else {
      // Tie
      await prisma.$transaction([
        prisma.fantasyTeam.update({
          where: { id: matchup.team1Id },
          data: { ties: { increment: 1 } },
        }),
        prisma.fantasyTeam.update({
          where: { id: matchup.team2Id },
          data: { ties: { increment: 1 } },
        }),
      ]);
    }

    // Update total points for each team
    await prisma.$transaction([
      prisma.fantasyTeam.update({
        where: { id: matchup.team1Id },
        data: { totalPoints: { increment: team1Score } },
      }),
      prisma.fantasyTeam.update({
        where: { id: matchup.team2Id },
        data: { totalPoints: { increment: team2Score } },
      }),
    ]);
  }
}

// Re-score all matches for a league (useful if scoring rules change)
export async function rescoreLeague(leagueId: string): Promise<void> {
  // Get all matches for this league's scoring periods
  const matches = await prisma.cdlMatch.findMany({
    where: {
      scoringPeriod: {
        leagueId,
      },
      status: 'COMPLETED',
    },
  });

  for (const match of matches) {
    await computeMatchFantasyPoints(match.id, leagueId);
  }

  // Update all team totals
  const periods = await prisma.scoringPeriod.findMany({
    where: { leagueId },
  });

  for (const period of periods) {
    await updateTeamTotals(leagueId, period.id);
  }
}
