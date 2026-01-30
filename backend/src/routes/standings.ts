import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * @swagger
 * /api/standings/league/{leagueId}:
 *   get:
 *     tags: [Standings]
 *     summary: Get league standings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: League standings
 */
router.get('/league/:leagueId', authenticate, async (req, res, next) => {
  try {
    const { leagueId } = req.params;

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        fantasyTeams: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
            teamTotals: {
              orderBy: { scoringPeriod: { startDate: 'desc' } },
              take: 5,
              include: {
                scoringPeriod: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!league) {
      throw new AppError('League not found', 404);
    }

    // Sort teams by wins, then by total points for tiebreaker
    const standings = league.fantasyTeams
      .map((team) => {
        const winPercentage = team.wins + team.losses + team.ties > 0
          ? team.wins / (team.wins + team.losses + team.ties)
          : 0;

        // Get recent performance
        const recentScores = team.teamTotals.map((t) => ({
          period: t.scoringPeriod.name,
          points: t.starterPoints,
        }));

        return {
          id: team.id,
          name: team.name,
          logoUrl: team.logoUrl,
          user: team.user,
          wins: team.wins,
          losses: team.losses,
          ties: team.ties,
          totalPoints: team.totalPoints,
          winPercentage,
          recentScores,
        };
      })
      .sort((a, b) => {
        // Sort by wins first
        if (b.wins !== a.wins) return b.wins - a.wins;
        // Then by total points (tiebreaker)
        return b.totalPoints - a.totalPoints;
      })
      .map((team, index) => ({
        ...team,
        rank: index + 1,
      }));

    res.json({ standings });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/standings/league/{leagueId}/period/{periodId}:
 *   get:
 *     tags: [Standings]
 *     summary: Get standings for a specific scoring period
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: periodId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Period standings
 */
router.get('/league/:leagueId/period/:periodId', authenticate, async (req, res, next) => {
  try {
    const { leagueId, periodId } = req.params;

    const period = await prisma.scoringPeriod.findUnique({
      where: { id: periodId },
      include: {
        matchups: {
          include: {
            team1: {
              include: {
                user: { select: { username: true, displayName: true } },
              },
            },
            team2: {
              include: {
                user: { select: { username: true, displayName: true } },
              },
            },
          },
        },
        teamTotals: {
          include: {
            fantasyTeam: {
              include: {
                user: { select: { username: true, displayName: true } },
              },
            },
          },
          orderBy: { starterPoints: 'desc' },
        },
      },
    });

    if (!period) {
      throw new AppError('Scoring period not found', 404);
    }

    if (period.leagueId !== leagueId) {
      throw new AppError('Period does not belong to this league', 400);
    }

    // Rank teams by points for this period
    const periodRankings = period.teamTotals.map((total, index) => ({
      rank: index + 1,
      team: total.fantasyTeam,
      starterPoints: total.starterPoints,
      benchPoints: total.benchPoints,
      totalPoints: total.totalPoints,
    }));

    res.json({
      period,
      rankings: periodRankings,
      matchups: period.matchups,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/standings/team/{teamId}/history:
 *   get:
 *     tags: [Standings]
 *     summary: Get a team's performance history
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
 *         description: Team performance history
 */
router.get('/team/:teamId/history', authenticate, async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const team = await prisma.fantasyTeam.findUnique({
      where: { id: teamId },
      include: {
        user: {
          select: { username: true, displayName: true, avatarUrl: true },
        },
        teamTotals: {
          include: {
            scoringPeriod: true,
          },
          orderBy: { scoringPeriod: { startDate: 'asc' } },
        },
        homeMatchups: {
          include: {
            team2: {
              include: {
                user: { select: { username: true, displayName: true } },
              },
            },
            scoringPeriod: { select: { name: true } },
          },
        },
        awayMatchups: {
          include: {
            team1: {
              include: {
                user: { select: { username: true, displayName: true } },
              },
            },
            scoringPeriod: { select: { name: true } },
          },
        },
      },
    });

    if (!team) {
      throw new AppError('Team not found', 404);
    }

    // Combine and sort matchup history
    const matchupHistory = [
      ...team.homeMatchups.map((m) => ({
        periodName: m.scoringPeriod.name,
        opponent: m.team2,
        myScore: m.team1Score,
        opponentScore: m.team2Score,
        result: m.winnerId === teamId ? 'W' : m.winnerId ? 'L' : m.isCompleted ? 'T' : null,
        isCompleted: m.isCompleted,
      })),
      ...team.awayMatchups.map((m) => ({
        periodName: m.scoringPeriod.name,
        opponent: m.team1,
        myScore: m.team2Score,
        opponentScore: m.team1Score,
        result: m.winnerId === teamId ? 'W' : m.winnerId ? 'L' : m.isCompleted ? 'T' : null,
        isCompleted: m.isCompleted,
      })),
    ];

    // Calculate streaks
    let currentStreak = 0;
    let streakType: 'W' | 'L' | null = null;
    for (const match of matchupHistory.filter((m) => m.isCompleted).reverse()) {
      if (match.result === streakType || streakType === null) {
        streakType = match.result as 'W' | 'L';
        currentStreak++;
      } else {
        break;
      }
    }

    res.json({
      team: {
        id: team.id,
        name: team.name,
        user: team.user,
        wins: team.wins,
        losses: team.losses,
        ties: team.ties,
        totalPoints: team.totalPoints,
      },
      pointsHistory: team.teamTotals,
      matchupHistory,
      currentStreak: streakType ? `${streakType}${currentStreak}` : null,
    });
  } catch (error) {
    next(error);
  }
});

export { router as standingsRouter };
