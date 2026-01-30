import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import { getStatsProvider, StatsProvider } from '../providers/statsProvider.js';
import { computeMatchFantasyPoints, updateTeamTotals, resolveMatchups } from './scoringService.js';

// Get configured stats provider
function getProvider(): StatsProvider {
  return getStatsProvider(config.statsProvider);
}

/**
 * Sync CDL teams from provider to database
 */
export async function syncTeams(): Promise<{ added: number; updated: number }> {
  const provider = getProvider();
  const teams = await provider.getTeams();

  let added = 0;
  let updated = 0;

  for (const team of teams) {
    const result = await prisma.cdlTeam.upsert({
      where: { externalId: team.externalId },
      create: {
        externalId: team.externalId,
        name: team.name,
        abbreviation: team.abbreviation,
        logoUrl: team.logoUrl,
        primaryColor: team.primaryColor,
      },
      update: {
        name: team.name,
        abbreviation: team.abbreviation,
        logoUrl: team.logoUrl,
        primaryColor: team.primaryColor,
      },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      added++;
    } else {
      updated++;
    }
  }

  console.log(`Synced teams: ${added} added, ${updated} updated`);
  return { added, updated };
}

/**
 * Sync CDL players from provider to database
 */
export async function syncPlayers(): Promise<{ added: number; updated: number }> {
  const provider = getProvider();
  const players = await provider.getPlayers();

  let added = 0;
  let updated = 0;

  for (const player of players) {
    // Find team by external ID
    let cdlTeamId: string | null = null;
    if (player.teamExternalId) {
      const team = await prisma.cdlTeam.findUnique({
        where: { externalId: player.teamExternalId },
      });
      cdlTeamId = team?.id ?? null;
    }

    const result = await prisma.cdlPlayer.upsert({
      where: { externalId: player.externalId },
      create: {
        externalId: player.externalId,
        gamerTag: player.gamerTag,
        realName: player.realName,
        photoUrl: player.photoUrl,
        role: player.role,
        country: player.country,
        cdlTeamId,
        averageDraftPosition: player.averageDraftPosition,
      },
      update: {
        gamerTag: player.gamerTag,
        realName: player.realName,
        photoUrl: player.photoUrl,
        role: player.role,
        country: player.country,
        cdlTeamId,
        averageDraftPosition: player.averageDraftPosition,
      },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      added++;
    } else {
      updated++;
    }
  }

  console.log(`Synced players: ${added} added, ${updated} updated`);
  return { added, updated };
}

/**
 * Sync CDL schedule/matches from provider to database
 */
export async function syncSchedule(
  startDate: Date,
  endDate: Date
): Promise<{ added: number; updated: number }> {
  const provider = getProvider();
  const matches = await provider.getSchedule(startDate, endDate);

  let added = 0;
  let updated = 0;

  for (const match of matches) {
    // Find teams by external ID
    const homeTeam = await prisma.cdlTeam.findUnique({
      where: { externalId: match.homeTeamExternalId },
    });
    const awayTeam = await prisma.cdlTeam.findUnique({
      where: { externalId: match.awayTeamExternalId },
    });

    if (!homeTeam || !awayTeam) {
      console.warn(`Skipping match ${match.externalId}: teams not found`);
      continue;
    }

    const result = await prisma.cdlMatch.upsert({
      where: { externalId: match.externalId },
      create: {
        externalId: match.externalId,
        scheduledAt: match.scheduledAt,
        status: match.status,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        winnerId: match.winnerExternalId,
      },
      update: {
        scheduledAt: match.scheduledAt,
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        winnerId: match.winnerExternalId,
      },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      added++;
    } else {
      updated++;
    }
  }

  console.log(`Synced schedule: ${added} added, ${updated} updated`);
  return { added, updated };
}

/**
 * Ingest stats for a completed match
 */
export async function ingestMatchStats(matchExternalId: string): Promise<{ statsIngested: number }> {
  const provider = getProvider();

  // Check if match is complete
  const isComplete = await provider.isMatchComplete(matchExternalId);
  if (!isComplete) {
    console.log(`Match ${matchExternalId} is not yet complete`);
    return { statsIngested: 0 };
  }

  // Get the match from our database
  const match = await prisma.cdlMatch.findUnique({
    where: { externalId: matchExternalId },
  });

  if (!match) {
    console.warn(`Match ${matchExternalId} not found in database`);
    return { statsIngested: 0 };
  }

  // Get stats from provider
  const statLines = await provider.getMatchStats(matchExternalId);

  let statsIngested = 0;

  for (const stat of statLines) {
    // Find player by external ID
    const player = await prisma.cdlPlayer.findUnique({
      where: { externalId: stat.playerExternalId },
    });

    if (!player) {
      console.warn(`Player ${stat.playerExternalId} not found`);
      continue;
    }

    // Upsert stat line (idempotent)
    await prisma.playerStatLine.upsert({
      where: {
        matchId_playerId_mapNumber: {
          matchId: match.id,
          playerId: player.id,
          mapNumber: stat.mapNumber ?? 0,
        },
      },
      create: {
        matchId: match.id,
        playerId: player.id,
        mapNumber: stat.mapNumber,
        gameMode: stat.gameMode,
        kills: stat.kills,
        deaths: stat.deaths,
        assists: stat.assists,
        damage: stat.damage,
        objectiveTime: stat.objectiveTime,
        bombPlants: stat.bombPlants,
        bombDefuses: stat.bombDefuses,
        firstBloods: stat.firstBloods,
      },
      update: {
        gameMode: stat.gameMode,
        kills: stat.kills,
        deaths: stat.deaths,
        assists: stat.assists,
        damage: stat.damage,
        objectiveTime: stat.objectiveTime,
        bombPlants: stat.bombPlants,
        bombDefuses: stat.bombDefuses,
        firstBloods: stat.firstBloods,
      },
    });

    statsIngested++;
  }

  // Mark match as completed in our database
  await prisma.cdlMatch.update({
    where: { id: match.id },
    data: { status: 'COMPLETED' },
  });

  console.log(`Ingested ${statsIngested} stat lines for match ${matchExternalId}`);
  return { statsIngested };
}

/**
 * Process all pending completed matches and update fantasy scores
 */
export async function processCompletedMatches(): Promise<void> {
  // Find matches that are marked as completed but haven't been processed
  const pendingMatches = await prisma.cdlMatch.findMany({
    where: {
      status: 'COMPLETED',
      statLines: {
        none: {}, // No stats yet
      },
    },
    take: 50, // Process in batches
  });

  console.log(`Found ${pendingMatches.length} pending completed matches`);

  for (const match of pendingMatches) {
    try {
      // Ingest stats
      const result = await ingestMatchStats(match.externalId);

      if (result.statsIngested > 0) {
        // Compute fantasy points for all leagues that have this match in a scoring period
        const leagues = await prisma.league.findMany({
          where: {
            status: 'IN_SEASON',
            scoringPeriods: {
              some: {
                cdlMatches: {
                  some: { id: match.id },
                },
              },
            },
          },
        });

        for (const league of leagues) {
          await computeMatchFantasyPoints(match.id, league.id);
        }
      }
    } catch (error) {
      console.error(`Error processing match ${match.externalId}:`, error);
    }
  }
}

/**
 * Update standings for a scoring period after matches complete
 */
export async function updatePeriodStandings(scoringPeriodId: string): Promise<void> {
  const period = await prisma.scoringPeriod.findUnique({
    where: { id: scoringPeriodId },
    include: {
      league: true,
    },
  });

  if (!period) {
    throw new Error(`Scoring period ${scoringPeriodId} not found`);
  }

  // Update team totals
  await updateTeamTotals(period.leagueId, scoringPeriodId);

  // Check if period should be completed
  const now = new Date();
  if (now > period.endDate && !period.isCompleted) {
    // Resolve matchups
    await resolveMatchups(scoringPeriodId);

    // Mark period as completed
    await prisma.scoringPeriod.update({
      where: { id: scoringPeriodId },
      data: {
        isCompleted: true,
        isActive: false,
      },
    });

    console.log(`Scoring period ${period.name} marked as completed`);
  }
}

/**
 * Full sync: teams, players, and recent schedule
 */
export async function fullSync(): Promise<void> {
  console.log('Starting full data sync...');

  await syncTeams();
  await syncPlayers();

  // Sync schedule for past 2 weeks and next 4 weeks
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 28);

  await syncSchedule(startDate, endDate);
  await processCompletedMatches();

  console.log('Full sync complete');
}
