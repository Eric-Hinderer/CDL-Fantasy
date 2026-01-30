import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

const setLineupSchema = z.object({
  slots: z.array(z.object({
    rosterSlotId: z.string(),
    position: z.number().min(0),
    isStarter: z.boolean(),
  })),
});

/**
 * @swagger
 * /api/lineups/team/{teamId}/period/{periodId}:
 *   get:
 *     tags: [Lineups]
 *     summary: Get lineup for a team and scoring period
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
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
 *         description: Lineup details
 */
router.get('/team/:teamId/period/:periodId', authenticate, async (req, res, next) => {
  try {
    const { teamId, periodId } = req.params;

    // Get the lineup or return empty if not set
    let lineup = await prisma.lineup.findUnique({
      where: {
        fantasyTeamId_scoringPeriodId: {
          fantasyTeamId: teamId,
          scoringPeriodId: periodId,
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
                  },
                },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
        scoringPeriod: true,
        fantasyTeam: {
          include: {
            league: {
              select: { starterCount: true, rosterSize: true },
            },
          },
        },
      },
    });

    // Get roster to show available players
    const roster = await prisma.rosterSlot.findMany({
      where: { fantasyTeamId: teamId },
      include: {
        player: {
          include: {
            cdlTeam: {
              select: { name: true, abbreviation: true },
            },
          },
        },
      },
    });

    res.json({ lineup, roster });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/lineups/team/{teamId}/period/{periodId}:
 *   put:
 *     tags: [Lineups]
 *     summary: Set lineup for a scoring period
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: periodId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slots:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     rosterSlotId:
 *                       type: string
 *                     position:
 *                       type: integer
 *                     isStarter:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Lineup updated
 */
router.put('/team/:teamId/period/:periodId', authenticate, async (req, res, next) => {
  try {
    const { teamId, periodId } = req.params;
    const data = setLineupSchema.parse(req.body);

    // Verify ownership
    const fantasyTeam = await prisma.fantasyTeam.findUnique({
      where: { id: teamId },
      include: {
        league: true,
      },
    });

    if (!fantasyTeam) {
      throw new AppError('Team not found', 404);
    }

    if (fantasyTeam.userId !== req.user!.id) {
      throw new AppError('Not authorized to edit this lineup', 403);
    }

    // Check if period is locked
    const period = await prisma.scoringPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new AppError('Scoring period not found', 404);
    }

    if (new Date() > period.lockTime) {
      throw new AppError('Lineup is locked for this scoring period', 400);
    }

    // Validate starter count
    const starterCount = data.slots.filter((s) => s.isStarter).length;
    if (starterCount !== fantasyTeam.league.starterCount) {
      throw new AppError(
        `Must have exactly ${fantasyTeam.league.starterCount} starters`,
        400
      );
    }

    // Verify all roster slots belong to this team
    const rosterSlotIds = data.slots.map((s) => s.rosterSlotId);
    const rosterSlots = await prisma.rosterSlot.findMany({
      where: {
        id: { in: rosterSlotIds },
        fantasyTeamId: teamId,
      },
    });

    if (rosterSlots.length !== rosterSlotIds.length) {
      throw new AppError('Invalid roster slots', 400);
    }

    // Upsert lineup
    const lineup = await prisma.lineup.upsert({
      where: {
        fantasyTeamId_scoringPeriodId: {
          fantasyTeamId: teamId,
          scoringPeriodId: periodId,
        },
      },
      create: {
        fantasyTeamId: teamId,
        scoringPeriodId: periodId,
        slots: {
          create: data.slots.map((slot) => ({
            rosterSlotId: slot.rosterSlotId,
            position: slot.position,
            isStarter: slot.isStarter,
          })),
        },
      },
      update: {
        slots: {
          deleteMany: {},
          create: data.slots.map((slot) => ({
            rosterSlotId: slot.rosterSlotId,
            position: slot.position,
            isStarter: slot.isStarter,
          })),
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
                  },
                },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    res.json({ lineup });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/lineups/roster/{teamId}:
 *   get:
 *     tags: [Lineups]
 *     summary: Get full roster for a fantasy team
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
 *         description: Full roster
 */
router.get('/roster/:teamId', authenticate, async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const roster = await prisma.rosterSlot.findMany({
      where: { fantasyTeamId: teamId },
      include: {
        player: {
          include: {
            cdlTeam: {
              select: { name: true, abbreviation: true, logoUrl: true },
            },
            statLines: {
              take: 5,
              orderBy: { match: { scheduledAt: 'desc' } },
              include: {
                match: {
                  select: { scheduledAt: true },
                },
              },
            },
          },
        },
      },
    });

    // Calculate recent averages for each player
    const rosterWithStats = roster.map((slot) => {
      const stats = slot.player.statLines;
      const avgKd = stats.length > 0
        ? stats.reduce((sum, s) => sum + (s.deaths > 0 ? s.kills / s.deaths : s.kills), 0) / stats.length
        : 0;

      return {
        ...slot,
        recentAvgKd: avgKd,
        gamesPlayed: stats.length,
      };
    });

    res.json({ roster: rosterWithStats });
  } catch (error) {
    next(error);
  }
});

export { router as lineupsRouter };
