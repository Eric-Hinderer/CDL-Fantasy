import { Worker, Job } from 'bullmq';
import { redis } from './lib/redis.js';
import {
  QUEUE_NAMES,
  StatsSyncJobData,
  ScoringJobData,
  DraftJobData,
} from './lib/queue.js';
import { prisma } from './lib/prisma.js';
import {
  fullSync,
  ingestMatchStats,
  updatePeriodStandings,
} from './services/dataIngestionService.js';
import { computeMatchFantasyPoints } from './services/scoringService.js';

console.log('🚀 Starting CDL Fantasy Worker...');

// ============================================================================
// STATS SYNC WORKER
// Handles schedule sync and match stats ingestion
// ============================================================================

const statsSyncWorker = new Worker<StatsSyncJobData>(
  QUEUE_NAMES.STATS_SYNC,
  async (job: Job<StatsSyncJobData>) => {
    console.log(`Processing job ${job.id}: ${job.data.type}`);

    switch (job.data.type) {
      case 'sync-schedule':
        await fullSync();
        break;

      case 'sync-match-stats':
        await ingestMatchStats(job.data.matchId);
        break;

      default:
        console.warn(`Unknown job type: ${(job.data as any).type}`);
    }
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

statsSyncWorker.on('completed', (job) => {
  console.log(`✅ Stats sync job ${job.id} completed`);
});

statsSyncWorker.on('failed', (job, err) => {
  console.error(`❌ Stats sync job ${job?.id} failed:`, err);
});

// ============================================================================
// SCORING WORKER
// Handles fantasy points computation and standings updates
// ============================================================================

const scoringWorker = new Worker<ScoringJobData>(
  QUEUE_NAMES.SCORING,
  async (job: Job<ScoringJobData>) => {
    console.log(`Processing job ${job.id}: ${job.data.type}`);

    switch (job.data.type) {
      case 'compute-fantasy-points':
        await computeMatchFantasyPoints(job.data.matchId, job.data.leagueId);
        break;

      case 'update-standings':
        await updatePeriodStandings(job.data.scoringPeriodId);
        break;

      case 'lock-lineups':
        await lockLineupsForPeriod(job.data.scoringPeriodId);
        break;

      default:
        console.warn(`Unknown job type: ${(job.data as any).type}`);
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

scoringWorker.on('completed', (job) => {
  console.log(`✅ Scoring job ${job.id} completed`);
});

scoringWorker.on('failed', (job, err) => {
  console.error(`❌ Scoring job ${job?.id} failed:`, err);
});

// ============================================================================
// DRAFT WORKER
// Handles auto-picks when users time out
// ============================================================================

const draftWorker = new Worker<DraftJobData>(
  QUEUE_NAMES.DRAFT,
  async (job: Job<DraftJobData>) => {
    console.log(`Processing job ${job.id}: ${job.data.type}`);

    switch (job.data.type) {
      case 'auto-pick':
        await processAutoPick(job.data.draftId, job.data.pickNumber);
        break;

      default:
        console.warn(`Unknown job type: ${(job.data as any).type}`);
    }
  },
  {
    connection: redis,
    concurrency: 1, // Process drafts sequentially to avoid conflicts
  }
);

draftWorker.on('completed', (job) => {
  console.log(`✅ Draft job ${job.id} completed`);
});

draftWorker.on('failed', (job, err) => {
  console.error(`❌ Draft job ${job?.id} failed:`, err);
});

// ============================================================================
// JOB IMPLEMENTATIONS
// ============================================================================

async function lockLineupsForPeriod(scoringPeriodId: string): Promise<void> {
  const period = await prisma.scoringPeriod.findUnique({
    where: { id: scoringPeriodId },
  });

  if (!period) {
    throw new Error(`Scoring period ${scoringPeriodId} not found`);
  }

  // Lock all lineups for this period
  await prisma.lineup.updateMany({
    where: {
      scoringPeriodId,
      isLocked: false,
    },
    data: { isLocked: true },
  });

  console.log(`Locked lineups for scoring period: ${period.name}`);
}

async function processAutoPick(draftId: string, expectedPickNumber: number): Promise<void> {
  const draftSettings = await prisma.draftSettings.findUnique({
    where: { id: draftId },
    include: {
      picks: true,
      league: {
        include: {
          fantasyTeams: true,
        },
      },
    },
  });

  if (!draftSettings) {
    console.log(`Draft ${draftId} not found, skipping auto-pick`);
    return;
  }

  // Check if this pick was already made (user picked in time)
  if (draftSettings.currentPick !== expectedPickNumber) {
    console.log(`Pick ${expectedPickNumber} already made, skipping auto-pick`);
    return;
  }

  if (draftSettings.status !== 'IN_PROGRESS') {
    console.log(`Draft ${draftId} is not in progress, skipping auto-pick`);
    return;
  }

  // Determine who should be picking
  const teamCount = draftSettings.draftOrder.length as number;
  const currentPick = draftSettings.currentPick;
  const round = Math.ceil(currentPick / teamCount);
  const positionInRound = (currentPick - 1) % teamCount;

  // Snake draft: reverse direction on even rounds
  const isReverseRound = round % 2 === 0;
  const orderIndex = isReverseRound
    ? teamCount - 1 - positionInRound
    : positionInRound;

  const draftOrder = draftSettings.draftOrder as string[];
  const currentTeamId = draftOrder[orderIndex];

  // Find best available player (by ADP)
  const draftedPlayerIds = draftSettings.picks.map((p) => p.playerId);

  const bestAvailable = await prisma.cdlPlayer.findFirst({
    where: {
      isActive: true,
      id: { notIn: draftedPlayerIds },
    },
    orderBy: [
      { averageDraftPosition: 'asc' },
      { gamerTag: 'asc' },
    ],
  });

  if (!bestAvailable) {
    console.error(`No players available for auto-pick in draft ${draftId}`);
    return;
  }

  // Make the pick
  await prisma.draftPick.create({
    data: {
      draftSettingsId: draftId,
      fantasyTeamId: currentTeamId,
      playerId: bestAvailable.id,
      pickNumber: currentPick,
      round,
      isAutoPick: true,
    },
  });

  // Add to roster
  await prisma.rosterSlot.create({
    data: {
      fantasyTeamId: currentTeamId,
      playerId: bestAvailable.id,
    },
  });

  // Check if draft is complete
  const totalPicks = teamCount * draftSettings.league.rosterSize;
  const isComplete = currentPick >= totalPicks;

  if (isComplete) {
    // Complete draft
    await prisma.$transaction([
      prisma.draftSettings.update({
        where: { id: draftId },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
        },
      }),
      prisma.league.update({
        where: { id: draftSettings.leagueId },
        data: { status: 'IN_SEASON' },
      }),
    ]);

    console.log(`Draft ${draftId} completed via auto-pick`);
  } else {
    // Advance to next pick
    const nextPick = currentPick + 1;
    const nextRound = Math.ceil(nextPick / teamCount);

    await prisma.draftSettings.update({
      where: { id: draftId },
      data: {
        currentPick: nextPick,
        currentRound: nextRound,
      },
    });

    // Schedule next auto-pick
    const { draftQueue } = await import('./lib/queue.js');
    await draftQueue.add(
      'auto-pick',
      {
        type: 'auto-pick',
        draftId,
        pickNumber: nextPick,
      },
      {
        delay: draftSettings.secondsPerPick * 1000,
        jobId: `auto-pick-${draftId}-${nextPick}`,
      }
    );
  }

  console.log(`Auto-picked ${bestAvailable.gamerTag} for team ${currentTeamId}`);
}

// ============================================================================
// SCHEDULED JOBS SETUP
// ============================================================================

async function setupScheduledJobs(): Promise<void> {
  const { statsSyncQueue, scoringQueue } = await import('./lib/queue.js');

  // Schedule full sync every 6 hours
  await statsSyncQueue.add(
    'sync-schedule',
    { type: 'sync-schedule' },
    {
      repeat: {
        pattern: '0 */6 * * *', // Every 6 hours
      },
      jobId: 'scheduled-sync',
    }
  );

  console.log('📅 Scheduled jobs set up');

  // Also run a sync on startup
  await statsSyncQueue.add(
    'sync-schedule',
    { type: 'sync-schedule' },
    {
      jobId: 'startup-sync',
    }
  );
}

// Schedule lineup lock checks
async function checkLineupLocks(): Promise<void> {
  const { scoringQueue } = await import('./lib/queue.js');

  // Find periods that need to be locked
  const periodsToLock = await prisma.scoringPeriod.findMany({
    where: {
      lockTime: { lte: new Date() },
      isCompleted: false,
      lineups: {
        some: {
          isLocked: false,
        },
      },
    },
  });

  for (const period of periodsToLock) {
    await scoringQueue.add(
      'lock-lineups',
      { type: 'lock-lineups', scoringPeriodId: period.id },
      { jobId: `lock-lineups-${period.id}` }
    );
  }
}

// Check for period completions and update standings
async function checkPeriodCompletions(): Promise<void> {
  const { scoringQueue } = await import('./lib/queue.js');

  // Find periods that have ended but aren't marked complete
  const periodsToComplete = await prisma.scoringPeriod.findMany({
    where: {
      endDate: { lte: new Date() },
      isCompleted: false,
    },
  });

  for (const period of periodsToComplete) {
    await scoringQueue.add(
      'update-standings',
      {
        type: 'update-standings',
        leagueId: period.leagueId,
        scoringPeriodId: period.id,
      },
      { jobId: `update-standings-${period.id}` }
    );
  }
}

// ============================================================================
// WORKER STARTUP
// ============================================================================

async function start(): Promise<void> {
  await setupScheduledJobs();

  // Run periodic checks every 5 minutes
  setInterval(async () => {
    try {
      await checkLineupLocks();
      await checkPeriodCompletions();
    } catch (error) {
      console.error('Error in periodic check:', error);
    }
  }, 5 * 60 * 1000);

  // Run initial checks
  await checkLineupLocks();
  await checkPeriodCompletions();

  console.log('✅ Worker started and ready');
}

start().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down workers...');
  await statsSyncWorker.close();
  await scoringWorker.close();
  await draftWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});
