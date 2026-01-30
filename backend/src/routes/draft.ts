import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { draftQueue } from '../lib/queue.js';

const router = Router();

/**
 * @swagger
 * /api/draft/league/{leagueId}:
 *   get:
 *     tags: [Draft]
 *     summary: Get draft state for a league
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
 *         description: Draft state
 */
router.get('/league/:leagueId', authenticate, async (req, res, next) => {
  try {
    const { leagueId } = req.params;

    const draftSettings = await prisma.draftSettings.findUnique({
      where: { leagueId },
      include: {
        picks: {
          include: {
            player: {
              include: {
                cdlTeam: {
                  select: { name: true, abbreviation: true },
                },
              },
            },
            fantasyTeam: {
              include: {
                user: {
                  select: { username: true, displayName: true },
                },
              },
            },
          },
          orderBy: { pickNumber: 'asc' },
        },
        league: {
          include: {
            fantasyTeams: {
              include: {
                user: {
                  select: { id: true, username: true, displayName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!draftSettings) {
      throw new AppError('Draft not found', 404);
    }

    // Get available players
    const draftedPlayerIds = draftSettings.picks.map((p) => p.playerId);
    const availablePlayers = await prisma.cdlPlayer.findMany({
      where: {
        isActive: true,
        id: { notIn: draftedPlayerIds },
      },
      include: {
        cdlTeam: {
          select: { name: true, abbreviation: true },
        },
      },
      orderBy: [
        { averageDraftPosition: 'asc' },
        { gamerTag: 'asc' },
      ],
    });

    // Calculate current pick info
    const { currentTeam, pickDeadline } = calculateCurrentPick(draftSettings);

    res.json({
      draftSettings,
      availablePlayers,
      currentTeam,
      pickDeadline,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/draft/league/{leagueId}/start:
 *   post:
 *     tags: [Draft]
 *     summary: Start the draft (owner only)
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
 *         description: Draft started
 */
router.post('/league/:leagueId/start', authenticate, async (req, res, next) => {
  try {
    const { leagueId } = req.params;

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        fantasyTeams: true,
        draftSettings: true,
      },
    });

    if (!league) {
      throw new AppError('League not found', 404);
    }

    if (league.ownerId !== req.user!.id) {
      throw new AppError('Only the league owner can start the draft', 403);
    }

    if (league.status !== 'PRE_DRAFT') {
      throw new AppError('Draft has already started or completed', 400);
    }

    if (league.fantasyTeams.length < 2) {
      throw new AppError('Need at least 2 teams to start draft', 400);
    }

    // Randomize draft order
    const shuffledTeams = [...league.fantasyTeams].sort(() => Math.random() - 0.5);
    const draftOrder = shuffledTeams.map((t) => t.id);

    // Update draft settings and league status
    const [draftSettings] = await prisma.$transaction([
      prisma.draftSettings.update({
        where: { leagueId },
        data: {
          draftOrder,
          status: 'IN_PROGRESS',
          startTime: new Date(),
          currentPick: 1,
          currentRound: 1,
        },
      }),
      prisma.league.update({
        where: { id: leagueId },
        data: { status: 'DRAFTING' },
      }),
    ]);

    // Schedule auto-pick job for first pick
    await scheduleAutoPick(draftSettings.id, 1, draftSettings.secondsPerPick);

    res.json({ message: 'Draft started', draftOrder });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/draft/league/{leagueId}/pick:
 *   post:
 *     tags: [Draft]
 *     summary: Make a draft pick
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leagueId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [playerId]
 *             properties:
 *               playerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pick made
 */
router.post('/league/:leagueId/pick', authenticate, async (req, res, next) => {
  try {
    const { leagueId } = req.params;
    const { playerId } = z.object({ playerId: z.string() }).parse(req.body);

    const result = await makePick(leagueId, req.user!.id, playerId, false);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Helper function to make a pick
export async function makePick(
  leagueId: string,
  userId: string,
  playerId: string,
  isAutoPick: boolean
): Promise<{ pick: any; isComplete: boolean }> {
  const draftSettings = await prisma.draftSettings.findUnique({
    where: { leagueId },
    include: {
      league: {
        include: {
          fantasyTeams: true,
        },
      },
      picks: true,
    },
  });

  if (!draftSettings) {
    throw new AppError('Draft not found', 404);
  }

  if (draftSettings.status !== 'IN_PROGRESS') {
    throw new AppError('Draft is not in progress', 400);
  }

  // Determine who should be picking
  const { currentTeamId, round } = getCurrentPickInfo(draftSettings);

  // Verify it's the user's turn (unless auto-pick)
  const userTeam = draftSettings.league.fantasyTeams.find((t) => t.userId === userId);
  if (!isAutoPick && (!userTeam || userTeam.id !== currentTeamId)) {
    throw new AppError('Not your turn to pick', 400);
  }

  // Check if player is available
  const alreadyPicked = draftSettings.picks.some((p) => p.playerId === playerId);
  if (alreadyPicked) {
    throw new AppError('Player has already been drafted', 400);
  }

  // Make the pick
  const pick = await prisma.draftPick.create({
    data: {
      draftSettingsId: draftSettings.id,
      fantasyTeamId: currentTeamId,
      playerId,
      pickNumber: draftSettings.currentPick,
      round,
      isAutoPick,
    },
    include: {
      player: {
        include: {
          cdlTeam: { select: { name: true, abbreviation: true } },
        },
      },
      fantasyTeam: {
        include: {
          user: { select: { username: true, displayName: true } },
        },
      },
    },
  });

  // Add player to roster
  await prisma.rosterSlot.create({
    data: {
      fantasyTeamId: currentTeamId,
      playerId,
    },
  });

  // Check if draft is complete
  const totalPicks = draftSettings.league.fantasyTeams.length * draftSettings.league.rosterSize;
  const isComplete = draftSettings.currentPick >= totalPicks;

  if (isComplete) {
    // Complete draft
    await prisma.$transaction([
      prisma.draftSettings.update({
        where: { id: draftSettings.id },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
        },
      }),
      prisma.league.update({
        where: { id: leagueId },
        data: { status: 'IN_SEASON' },
      }),
    ]);
  } else {
    // Advance pick
    const nextPick = draftSettings.currentPick + 1;
    const nextRound = Math.ceil(nextPick / draftSettings.league.fantasyTeams.length);

    await prisma.draftSettings.update({
      where: { id: draftSettings.id },
      data: {
        currentPick: nextPick,
        currentRound: nextRound,
      },
    });

    // Schedule next auto-pick
    await scheduleAutoPick(draftSettings.id, nextPick, draftSettings.secondsPerPick);
  }

  return { pick, isComplete };
}

// Helper to calculate current pick info for snake draft
function getCurrentPickInfo(draftSettings: any) {
  const teamCount = draftSettings.draftOrder.length;
  const currentPick = draftSettings.currentPick;
  const round = Math.ceil(currentPick / teamCount);
  const positionInRound = ((currentPick - 1) % teamCount);

  // Snake draft: reverse direction on odd rounds
  const isReverseRound = round % 2 === 0;
  const orderIndex = isReverseRound
    ? teamCount - 1 - positionInRound
    : positionInRound;

  const currentTeamId = draftSettings.draftOrder[orderIndex];

  return { currentTeamId, round, positionInRound };
}

function calculateCurrentPick(draftSettings: any) {
  if (draftSettings.status !== 'IN_PROGRESS') {
    return { currentTeam: null, pickDeadline: null };
  }

  const { currentTeamId } = getCurrentPickInfo(draftSettings);
  const currentTeam = draftSettings.league.fantasyTeams.find(
    (t: any) => t.id === currentTeamId
  );

  // Calculate deadline (last pick time + seconds per pick)
  const lastPick = draftSettings.picks[draftSettings.picks.length - 1];
  const lastPickTime = lastPick?.pickedAt || draftSettings.startTime;
  const pickDeadline = new Date(
    new Date(lastPickTime).getTime() + draftSettings.secondsPerPick * 1000
  );

  return { currentTeam, pickDeadline };
}

async function scheduleAutoPick(draftId: string, pickNumber: number, delaySeconds: number) {
  await draftQueue.add(
    'auto-pick',
    {
      type: 'auto-pick',
      draftId,
      pickNumber,
    },
    {
      delay: delaySeconds * 1000,
      jobId: `auto-pick-${draftId}-${pickNumber}`, // Prevents duplicate jobs
    }
  );
}

export { router as draftRouter };
