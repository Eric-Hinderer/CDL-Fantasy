import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * @swagger
 * /api/players:
 *   get:
 *     tags: [Players]
 *     summary: Get all CDL players
 *     parameters:
 *       - in: query
 *         name: teamId
 *         schema:
 *           type: string
 *         description: Filter by CDL team
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by gamer tag
 *       - in: query
 *         name: available
 *         schema:
 *           type: boolean
 *         description: Only show players not on any fantasy roster in the league
 *       - in: query
 *         name: leagueId
 *         schema:
 *           type: string
 *         description: League ID for availability check
 *     responses:
 *       200:
 *         description: List of players
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { teamId, search, available, leagueId } = req.query;

    let draftedPlayerIds: string[] = [];

    // If checking availability, get list of drafted players
    if (available === 'true' && leagueId) {
      const draftedPlayers = await prisma.rosterSlot.findMany({
        where: {
          fantasyTeam: {
            leagueId: leagueId as string,
          },
        },
        select: { playerId: true },
      });
      draftedPlayerIds = draftedPlayers.map((p) => p.playerId);
    }

    const players = await prisma.cdlPlayer.findMany({
      where: {
        isActive: true,
        ...(teamId && { cdlTeamId: teamId as string }),
        ...(search && {
          gamerTag: {
            contains: search as string,
            mode: 'insensitive',
          },
        }),
        ...(available === 'true' && {
          id: {
            notIn: draftedPlayerIds,
          },
        }),
      },
      include: {
        cdlTeam: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
            logoUrl: true,
          },
        },
      },
      orderBy: [
        { averageDraftPosition: 'asc' },
        { gamerTag: 'asc' },
      ],
    });

    res.json({ players });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/players/{id}:
 *   get:
 *     tags: [Players]
 *     summary: Get player details with stats
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Player details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const player = await prisma.cdlPlayer.findUnique({
      where: { id: req.params.id },
      include: {
        cdlTeam: true,
        statLines: {
          include: {
            match: {
              include: {
                homeTeam: { select: { name: true, abbreviation: true } },
                awayTeam: { select: { name: true, abbreviation: true } },
              },
            },
          },
          orderBy: { match: { scheduledAt: 'desc' } },
          take: 20,
        },
      },
    });

    if (!player) {
      throw new AppError('Player not found', 404);
    }

    // Calculate averages
    const recentStats = player.statLines.slice(0, 10);
    const avgStats = recentStats.length > 0 ? {
      avgKills: recentStats.reduce((sum, s) => sum + s.kills, 0) / recentStats.length,
      avgDeaths: recentStats.reduce((sum, s) => sum + s.deaths, 0) / recentStats.length,
      avgKd: recentStats.reduce((sum, s) => sum + (s.deaths > 0 ? s.kills / s.deaths : s.kills), 0) / recentStats.length,
      avgDamage: recentStats.reduce((sum, s) => sum + s.damage, 0) / recentStats.length,
    } : null;

    res.json({ player, avgStats });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/players/{id}/fantasy-points:
 *   get:
 *     tags: [Players]
 *     summary: Get player's fantasy points history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fantasy points history
 */
router.get('/:id/fantasy-points', authenticate, async (req, res, next) => {
  try {
    const { leagueId } = req.query;

    if (!leagueId) {
      throw new AppError('leagueId is required', 400);
    }

    const fantasyPoints = await prisma.fantasyPoints.findMany({
      where: {
        leagueId: leagueId as string,
        statLine: {
          playerId: req.params.id,
        },
      },
      include: {
        statLine: {
          include: {
            match: {
              select: {
                scheduledAt: true,
                homeTeam: { select: { abbreviation: true } },
                awayTeam: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
      orderBy: {
        statLine: {
          match: {
            scheduledAt: 'desc',
          },
        },
      },
    });

    res.json({ fantasyPoints });
  } catch (error) {
    next(error);
  }
});

export { router as playersRouter };
