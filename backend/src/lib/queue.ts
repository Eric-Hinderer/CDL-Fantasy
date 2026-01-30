import { Queue, QueueEvents } from 'bullmq';
import { redis } from './redis.js';

// Queue names
export const QUEUE_NAMES = {
  STATS_SYNC: 'stats-sync',
  SCORING: 'scoring',
  DRAFT: 'draft',
} as const;

// Create queues
export const statsSyncQueue = new Queue(QUEUE_NAMES.STATS_SYNC, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const scoringQueue = new Queue(QUEUE_NAMES.SCORING, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const draftQueue = new Queue(QUEUE_NAMES.DRAFT, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 1, // Draft picks should not retry
  },
});

// Queue events for monitoring
export const statsSyncEvents = new QueueEvents(QUEUE_NAMES.STATS_SYNC, {
  connection: redis,
});

export const scoringEvents = new QueueEvents(QUEUE_NAMES.SCORING, {
  connection: redis,
});

// Job types
export interface SyncScheduleJob {
  type: 'sync-schedule';
}

export interface SyncMatchStatsJob {
  type: 'sync-match-stats';
  matchId: string;
}

export interface ComputeFantasyPointsJob {
  type: 'compute-fantasy-points';
  matchId: string;
  leagueId: string;
}

export interface UpdateStandingsJob {
  type: 'update-standings';
  leagueId: string;
  scoringPeriodId: string;
}

export interface LockLineupsJob {
  type: 'lock-lineups';
  scoringPeriodId: string;
}

export interface AutoPickJob {
  type: 'auto-pick';
  draftId: string;
  pickNumber: number;
}

export type StatsSyncJobData = SyncScheduleJob | SyncMatchStatsJob;
export type ScoringJobData = ComputeFantasyPointsJob | UpdateStandingsJob | LockLineupsJob;
export type DraftJobData = AutoPickJob;
