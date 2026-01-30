import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { DEFAULT_SCORING_RULES } from '../config/index.js';
import { generateJoinCode, generateMatchups } from '../services/leagueService.js';
// Scoring service functions available if needed:
// import { updateTeamTotals, resolveMatchups, computeMatchFantasyPoints } from '../services/scoringService.js';

const router = Router();

const createLeagueSchema = z.object({
  name: z.string().min(3).max(50),
  isPublic: z.boolean().default(false),
  maxTeams: z.number().min(4).max(16).default(8),
  rosterSize: z.number().min(4).max(10).default(6),
  starterCount: z.number().min(2).max(6).default(4),
  scoringRules: z.object({
    killPoints: z.number().default(1.0),
    deathPoints: z.number().default(-0.5),
    assistPoints: z.number().default(0.25),
    damagePoints: z.number().default(0.01),
    objectiveTimePoints: z.number().default(0.02),
    bombPlantPoints: z.number().default(2.0),
    bombDefusePoints: z.number().default(2.0),
    firstBloodPoints: z.number().default(1.5),
  }).optional(),
});

const joinLeagueSchema = z.object({
  joinCode: z.string().length(6),
  teamName: z.string().min(3).max(30),
});

/**
 * @swagger
 * /api/leagues:
 *   post:
 *     tags: [Leagues]
 *     summary: Create a new league
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *               maxTeams:
 *                 type: integer
 *               rosterSize:
 *                 type: integer
 *               starterCount:
 *                 type: integer
 *     responses:
 *       201:
 *         description: League created
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = createLeagueSchema.parse(req.body);

    if (data.starterCount > data.rosterSize) {
      throw new AppError('Starter count cannot exceed roster size', 400);
    }

    const joinCode = await generateJoinCode();

    const league = await prisma.league.create({
      data: {
        name: data.name,
        joinCode,
        isPublic: data.isPublic,
        maxTeams: data.maxTeams,
        rosterSize: data.rosterSize,
        starterCount: data.starterCount,
        scoringRules: (data.scoringRules || DEFAULT_SCORING_RULES) as any,
        ownerId: req.user!.id,
        // Create owner's fantasy team automatically
        fantasyTeams: {
          create: {
            name: `${req.user!.username}'s Team`,
            userId: req.user!.id,
          },
        },
        // Create draft settings
        draftSettings: {
          create: {
            secondsPerPick: 60,
          },
        },
      },
      include: {
        fantasyTeams: true,
        draftSettings: true,
      },
    });

    res.status(201).json({ league });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/leagues:
 *   get:
 *     tags: [Leagues]
 *     summary: Get user's leagues
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of leagues
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const leagues = await prisma.league.findMany({
      where: {
        fantasyTeams: {
          some: {
            userId: req.user!.id,
          },
        },
      },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true },
        },
        fantasyTeams: {
          select: {
            id: true,
            name: true,
            wins: true,
            losses: true,
            ties: true,
            totalPoints: true,
            user: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
        _count: {
          select: { fantasyTeams: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ leagues });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/leagues/{id}:
 *   get:
 *     tags: [Leagues]
 *     summary: Get league details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: League details
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const league = await prisma.league.findUnique({
      where: { id: req.params.id },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true },
        },
        fantasyTeams: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true },
            },
          },
          orderBy: [
            { wins: 'desc' },
            { totalPoints: 'desc' },
          ],
        },
        scoringPeriods: {
          orderBy: { startDate: 'asc' },
        },
        draftSettings: true,
      },
    });

    if (!league) {
      throw new AppError('League not found', 404);
    }

    // Check if user is a member
    const isMember = league.fantasyTeams.some((t) => t.userId === req.user!.id);
    if (!isMember && !league.isPublic) {
      throw new AppError('Not authorized to view this league', 403);
    }

    // Get user's team in this league
    const userTeam = league.fantasyTeams.find((t) => t.userId === req.user!.id);

    res.json({ league, userTeam });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/leagues/join:
 *   post:
 *     tags: [Leagues]
 *     summary: Join a league by code
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [joinCode, teamName]
 *             properties:
 *               joinCode:
 *                 type: string
 *               teamName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Joined league
 */
router.post('/join', authenticate, async (req, res, next) => {
  try {
    const data = joinLeagueSchema.parse(req.body);

    const league = await prisma.league.findUnique({
      where: { joinCode: data.joinCode.toUpperCase() },
      include: {
        fantasyTeams: true,
      },
    });

    if (!league) {
      throw new AppError('Invalid join code', 404);
    }

    // Check if already a member
    const existingTeam = league.fantasyTeams.find((t) => t.userId === req.user!.id);
    if (existingTeam) {
      throw new AppError('You are already in this league', 400);
    }

    // Check if league is full
    if (league.fantasyTeams.length >= league.maxTeams) {
      throw new AppError('League is full', 400);
    }

    // Check if draft has started
    if (league.status !== 'PRE_DRAFT') {
      throw new AppError('Cannot join league after draft has started', 400);
    }

    const fantasyTeam = await prisma.fantasyTeam.create({
      data: {
        name: data.teamName,
        userId: req.user!.id,
        leagueId: league.id,
      },
      include: {
        league: true,
      },
    });

    res.json({ fantasyTeam });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/leagues/{id}/scoring-periods:
 *   get:
 *     tags: [Leagues]
 *     summary: Get league scoring periods
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of scoring periods
 */
router.get('/:id/scoring-periods', authenticate, async (req, res, next) => {
  try {
    const periods = await prisma.scoringPeriod.findMany({
      where: { leagueId: req.params.id },
      include: {
        matchups: {
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
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    res.json({ scoringPeriods: periods });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/leagues/{id}/generate-schedule:
 *   post:
 *     tags: [Leagues]
 *     summary: Generate matchup schedule for league (owner only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule generated
 */
router.post('/:id/generate-schedule', authenticate, async (req, res, next) => {
  try {
    const league = await prisma.league.findUnique({
      where: { id: req.params.id },
      include: {
        fantasyTeams: true,
        scoringPeriods: true,
      },
    });

    if (!league) {
      throw new AppError('League not found', 404);
    }

    if (league.ownerId !== req.user!.id) {
      throw new AppError('Only the league owner can generate the schedule', 403);
    }

    if (league.fantasyTeams.length < 2) {
      throw new AppError('Need at least 2 teams to generate schedule', 400);
    }

    // Generate matchups for each scoring period
    for (const period of league.scoringPeriods) {
      await generateMatchups(period.id, league.fantasyTeams.map((t) => t.id));
    }

    res.json({ message: 'Schedule generated successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as leaguesRouter };
