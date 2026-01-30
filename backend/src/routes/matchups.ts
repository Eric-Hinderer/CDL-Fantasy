import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * @swagger
 * /api/matchups/league/{leagueId}:
 *   get:
 *     tags: [Matchups]
 *     summary: Get all matchups for a league
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: periodId
 *         schema:
 *           type: string
 *         description: Filter by scoring period
 *     responses:
 *       200:
 *         description: List of matchups
 */
router.get('/league/:leagueId', authenticate, async (req, res, next) => {
  try {
    const { leagueId } = req.params;
    const { periodId } = req.query;

    const matchups = await prisma.matchup.findMany({
      where: {
        scoringPeriod: {
          leagueId,
        },
        ...(periodId && { scoringPeriodId: periodId as string }),
      },
      include: {
        team1: {
          include: {
            user: {
              select: { username: true, displayName: true },
            },
          },
        },
        team2: {
          include: {
            user: {
              select: { username: true, displayName: true },
            },
          },
        },
        scoringPeriod: true,
      },
      orderBy: [
        { scoringPeriod: { startDate: 'asc' } },
        { id: 'asc' },
      ],
    });

    res.json({ matchups });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/matchups/{matchupId}:
 *   get:
 *     tags: [Matchups]
 *     summary: Get matchup details with box score
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matchup details with player scores
 */
router.get('/:matchupId', authenticate, async (req, res, next) => {
  try {
    const { matchupId } = req.params;

    const matchup = await prisma.matchup.findUnique({
      where: { id: matchupId },
      include: {
        team1: {
          include: {
            user: {
              select: { username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        team2: {
          include: {
            user: {
              select: { username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        scoringPeriod: {
          include: {
            league: {
              select: { id: true, scoringRules: true },
            },
          },
        },
      },
    });

    if (!matchup) {
      throw new AppError('Matchup not found', 404);
    }

    // Get lineups for both teams for this period
    const [team1Lineup, team2Lineup] = await Promise.all([
      getLineupWithPoints(matchup.team1Id, matchup.scoringPeriodId, matchup.scoringPeriod.league.id),
      getLineupWithPoints(matchup.team2Id, matchup.scoringPeriodId, matchup.scoringPeriod.league.id),
    ]);

    res.json({
      matchup,
      team1Lineup,
      team2Lineup,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/matchups/team/{teamId}/current:
 *   get:
 *     tags: [Matchups]
 *     summary: Get current matchup for a team
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current matchup
 */
router.get('/team/:teamId/current', authenticate, async (req, res, next) => {
  try {
    const { teamId } = req.params;

    // Find the current active scoring period
    const activePeriod = await prisma.scoringPeriod.findFirst({
      where: {
        league: {
          fantasyTeams: {
            some: { id: teamId },
          },
        },
        isActive: true,
        isCompleted: false,
      },
    });

    if (!activePeriod) {
      res.json({ matchup: null, message: 'No active scoring period' });
      return;
    }

    // Find matchup for this team in this period
    const matchup = await prisma.matchup.findFirst({
      where: {
        scoringPeriodId: activePeriod.id,
        OR: [
          { team1Id: teamId },
          { team2Id: teamId },
        ],
      },
      include: {
        team1: {
          include: {
            user: {
              select: { username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        team2: {
          include: {
            user: {
              select: { username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        scoringPeriod: true,
      },
    });

    res.json({ matchup, activePeriod });
  } catch (error) {
    next(error);
  }
});

// Helper function to get lineup with fantasy points
async function getLineupWithPoints(
  fantasyTeamId: string,
  scoringPeriodId: string,
  leagueId: string
) {
  const lineup = await prisma.lineup.findUnique({
    where: {
      fantasyTeamId_scoringPeriodId: {
        fantasyTeamId,
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
                  cdlTeam: {
                    select: { name: true, abbreviation: true },
                  },
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
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!lineup) {
    return null;
  }

  // Calculate total points for each player in lineup
  const slotsWithPoints = lineup.slots.map((slot) => {
    const totalPoints = slot.rosterSlot.player.statLines.reduce((sum, statLine) => {
      const fpRecord = statLine.fantasyPoints[0];
      return sum + (fpRecord?.points || 0);
    }, 0);

    return {
      ...slot,
      totalPoints,
    };
  });

  // Calculate team totals
  const starterPoints = slotsWithPoints
    .filter((s) => s.isStarter)
    .reduce((sum, s) => sum + s.totalPoints, 0);

  const benchPoints = slotsWithPoints
    .filter((s) => !s.isStarter)
    .reduce((sum, s) => sum + s.totalPoints, 0);

  return {
    ...lineup,
    slots: slotsWithPoints,
    starterPoints,
    benchPoints,
    totalPoints: starterPoints, // Only starters count
  };
}

/**
 * @swagger
 * /api/matchups/{matchupId}/simulate:
 *   post:
 *     tags: [Matchups]
 *     summary: Simulate completing a matchup (dev only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matchup completed
 */
router.post('/:matchupId/simulate', authenticate, async (req, res, next) => {
  try {
    const { matchupId } = req.params;

    const matchup = await prisma.matchup.findUnique({
      where: { id: matchupId },
      include: {
        scoringPeriod: {
          include: {
            league: true,
          },
        },
        team1: true,
        team2: true,
      },
    });

    if (!matchup) {
      throw new AppError('Matchup not found', 404);
    }

    if (matchup.isCompleted) {
      throw new AppError('Matchup already completed', 400);
    }

    const leagueId = matchup.scoringPeriod.league.id;
    const scoringPeriodId = matchup.scoringPeriodId;

    // Get lineups for both teams
    const [team1LineupRaw, team2LineupRaw] = await Promise.all([
      prisma.lineup.findUnique({
        where: {
          fantasyTeamId_scoringPeriodId: {
            fantasyTeamId: matchup.team1Id,
            scoringPeriodId,
          },
        },
        include: {
          slots: {
            include: {
              rosterSlot: {
                include: {
                  player: true,
                },
              },
            },
          },
        },
      }),
      prisma.lineup.findUnique({
        where: {
          fantasyTeamId_scoringPeriodId: {
            fantasyTeamId: matchup.team2Id,
            scoringPeriodId,
          },
        },
        include: {
          slots: {
            include: {
              rosterSlot: {
                include: {
                  player: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Create or find a simulated CDL match for this period
    let cdlMatch = await prisma.cdlMatch.findFirst({
      where: { scoringPeriodId },
    });

    if (!cdlMatch) {
      // Get two random CDL teams for the match
      const cdlTeams = await prisma.cdlTeam.findMany({ take: 2 });
      cdlMatch = await prisma.cdlMatch.create({
        data: {
          externalId: `sim-${scoringPeriodId}`,
          homeTeamId: cdlTeams[0]?.id || '',
          awayTeamId: cdlTeams[1]?.id || cdlTeams[0]?.id || '',
          scheduledAt: new Date(),
          status: 'COMPLETED',
          scoringPeriodId,
        },
      });
    }

    // Generate random stats for all players in both lineups
    const allSlots = [
      ...(team1LineupRaw?.slots || []),
      ...(team2LineupRaw?.slots || []),
    ];

    let team1Score = 0;
    let team2Score = 0;

    for (const slot of allSlots) {
      const player = slot.rosterSlot.player;
      
      // Check if this player already has stats for this match
      const existingStats = await prisma.playerStatLine.findFirst({
        where: {
          playerId: player.id,
          matchId: cdlMatch.id,
        },
      });

      if (existingStats) {
        // Use existing fantasy points
        const existingPoints = await prisma.fantasyPoints.findFirst({
          where: {
            statLineId: existingStats.id,
            leagueId,
          },
        });
        const points = existingPoints?.points || 0;
        if (team1LineupRaw?.slots.includes(slot) && slot.isStarter) {
          team1Score += points;
        } else if (team2LineupRaw?.slots.includes(slot) && slot.isStarter) {
          team2Score += points;
        }
        continue;
      }

      // Generate random stats
      const kills = Math.floor(Math.random() * 30) + 15;
      const deaths = Math.floor(Math.random() * 25) + 10;
      const assists = Math.floor(Math.random() * 10);
      const damage = Math.floor(Math.random() * 5000) + 3000;
      const objectiveTime = Math.floor(Math.random() * 120);
      const firstBloods = Math.floor(Math.random() * 5);

      // Create stat line
      const statLine = await prisma.playerStatLine.create({
        data: {
          playerId: player.id,
          matchId: cdlMatch.id,
          mapNumber: 1,
          gameMode: 'Hardpoint',
          kills,
          deaths,
          assists,
          damage,
          objectiveTime,
          firstBloods,
          bombPlants: 0,
          bombDefuses: 0,
        },
      });

      // Calculate fantasy points using simple formula
      const points = Math.round((
        kills * 1.5 +
        deaths * -1.0 +
        assists * 0.5 +
        damage * 0.002 +
        objectiveTime * 0.1 +
        firstBloods * 2.0
      ) * 10) / 10;

      // Create fantasy points record
      await prisma.fantasyPoints.create({
        data: {
          statLineId: statLine.id,
          leagueId,
          points,
        },
      });

      // Add to team score if starter
      const isTeam1Slot = team1LineupRaw?.slots.some(s => s.id === slot.id);
      if (slot.isStarter) {
        if (isTeam1Slot) {
          team1Score += points;
        } else {
          team2Score += points;
        }
      }
    }

    // Round scores
    team1Score = Math.round(team1Score * 10) / 10;
    team2Score = Math.round(team2Score * 10) / 10;

    const winnerId = team1Score >= team2Score ? matchup.team1Id : matchup.team2Id;

    // Update matchup
    const updatedMatchup = await prisma.matchup.update({
      where: { id: matchupId },
      data: {
        team1Score,
        team2Score,
        winnerId,
        isCompleted: true,
      },
    });

    // Update team records
    if (winnerId === matchup.team1Id) {
      await prisma.fantasyTeam.update({
        where: { id: matchup.team1Id },
        data: { wins: { increment: 1 }, totalPoints: { increment: team1Score } },
      });
      await prisma.fantasyTeam.update({
        where: { id: matchup.team2Id },
        data: { losses: { increment: 1 }, totalPoints: { increment: team2Score } },
      });
    } else {
      await prisma.fantasyTeam.update({
        where: { id: matchup.team2Id },
        data: { wins: { increment: 1 }, totalPoints: { increment: team2Score } },
      });
      await prisma.fantasyTeam.update({
        where: { id: matchup.team1Id },
        data: { losses: { increment: 1 }, totalPoints: { increment: team1Score } },
      });
    }

    res.json({
      message: 'Matchup simulated',
      matchup: updatedMatchup,
      team1Score,
      team2Score,
      winner: winnerId === matchup.team1Id ? matchup.team1.name : matchup.team2.name,
    });
  } catch (error) {
    next(error);
  }
});

export { router as matchupsRouter };
