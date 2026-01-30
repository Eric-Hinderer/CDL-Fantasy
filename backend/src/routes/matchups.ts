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
              select: { scoringRules: true },
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

export { router as matchupsRouter };
