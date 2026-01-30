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
import { makeAutoPick } from './routes/draft.js';

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

// processAutoPick now delegates to shared makeAutoPick function in routes/draft.ts
async function processAutoPick(draftId: string, expectedPickNumber: number): Promise<void> {
  await makeAutoPick(draftId, expectedPickNumber);
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
