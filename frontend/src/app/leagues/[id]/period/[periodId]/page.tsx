'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { leaguesApi, matchupsApi, standingsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatPoints, formatDate, formatDateTime } from '@/lib/utils';
import { ArrowLeft, Trophy, Clock, CheckCircle, Play } from 'lucide-react';

interface Matchup {
  id: string;
  team1: {
    id: string;
    name: string;
    user: { username: string; displayName?: string };
  };
  team2: {
    id: string;
    name: string;
    user: { username: string; displayName?: string };
  } | null;
  team1Score: number;
  team2Score: number;
  isCompleted: boolean;
  winnerId?: string;
}

export default function PeriodDetailPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const periodId = params.periodId as string;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [simulating, setSimulating] = useState(false);

  // Get league data
  const { data: leagueData, isLoading: leagueLoading, refetch: refetchLeague } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => leaguesApi.getLeague(leagueId),
  });

  // Get matchups for this period
  const { data: matchupsData, isLoading: matchupsLoading, refetch: refetchMatchups } = useQuery({
    queryKey: ['matchups', leagueId, periodId],
    queryFn: () => matchupsApi.getLeagueMatchups(leagueId, periodId),
  });

  // Get period standings
  const { data: standingsData, refetch: refetchStandings } = useQuery({
    queryKey: ['standings', leagueId, periodId],
    queryFn: () => standingsApi.getPeriodStandings(leagueId, periodId),
    enabled: !!periodId,
  });

  const league = leagueData?.league;
  const userTeam = leagueData?.userTeam;
  const matchups = matchupsData?.matchups || [];
  const standings = standingsData?.standings || [];

  // Find the period
  const period = league?.scoringPeriods?.find((p: any) => p.id === periodId);

  const isLeagueOwner = league?.ownerId === user?.id;
  const canSimulate = isLeagueOwner && period && !period.isCompleted;
  const incompleteMatchups = matchups.filter((m: Matchup) => !m.isCompleted);

  const handleSimulateAll = async () => {
    setSimulating(true);
    try {
      // Simulate all incomplete matchups
      for (const matchup of incompleteMatchups) {
        await matchupsApi.simulateMatchup(matchup.id);
        // Invalidate this matchup's cache
        queryClient.invalidateQueries({ queryKey: ['matchup', matchup.id] });
      }
      // Refetch all data
      await Promise.all([refetchLeague(), refetchMatchups(), refetchStandings()]);
      queryClient.invalidateQueries({ queryKey: ['standings', leagueId] });
    } catch (error) {
      console.error('Failed to simulate matchups:', error);
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateOne = async (matchupId: string) => {
    try {
      await matchupsApi.simulateMatchup(matchupId);
      // Invalidate this matchup's cache
      queryClient.invalidateQueries({ queryKey: ['matchup', matchupId] });
      await Promise.all([refetchLeague(), refetchMatchups(), refetchStandings()]);
      queryClient.invalidateQueries({ queryKey: ['standings', leagueId] });
    } catch (error) {
      console.error('Failed to simulate matchup:', error);
    }
  };

  const isLoading = leagueLoading || matchupsLoading;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-gray-800 rounded"></div>
        <div className="h-64 bg-gray-800 rounded"></div>
      </div>
    );
  }

  if (!period) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <h3 className="text-lg font-medium text-white">Period not found</h3>
          <Link href={`/leagues/${leagueId}`}>
            <Button className="mt-4">Back to League</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = () => {
    if (period.isCompleted) {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
          <CheckCircle className="h-3 w-3" />
          Completed
        </span>
      );
    }
    if (period.isActive) {
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-900 text-green-300">
          <Clock className="h-3 w-3" />
          Active
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-1 rounded bg-blue-900 text-blue-300">
        Upcoming
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href={`/leagues/${leagueId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{period.name}</h1>
            {getStatusBadge()}
          </div>
          <p className="text-gray-400 mt-1">
            {formatDate(period.startDate)} - {formatDate(period.endDate)}
          </p>
          {period.lockTime && (
            <p className="text-sm text-gray-500">
              Lineups locked: {formatDateTime(period.lockTime)}
            </p>
          )}
        </div>
        {canSimulate && incompleteMatchups.length > 0 && (
          <Button 
            onClick={handleSimulateAll} 
            disabled={simulating}
            variant="secondary"
          >
            <Play className="h-4 w-4 mr-2" />
            {simulating ? 'Simulating...' : `Simulate All (${incompleteMatchups.length})`}
          </Button>
        )}
      </div>

      {/* Matchups */}
      <Card>
        <CardHeader>
          <CardTitle>Matchups</CardTitle>
        </CardHeader>
        <CardContent>
          {matchups.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No matchups for this period</p>
          ) : (
            <div className="space-y-4">
              {matchups.map((matchup: Matchup) => {
                const isUserMatchup = 
                  matchup.team1?.id === userTeam?.id || 
                  matchup.team2?.id === userTeam?.id;
                
                const team1Won = matchup.isCompleted && matchup.winnerId === matchup.team1?.id;
                const team2Won = matchup.isCompleted && matchup.winnerId === matchup.team2?.id;
                const isTie = matchup.isCompleted && !matchup.winnerId;

                return (
                  <div
                    key={matchup.id}
                    className={`p-4 rounded-lg transition-colors ${
                      isUserMatchup
                        ? 'bg-primary-900/20 border border-primary-800'
                        : 'bg-gray-800'
                    }`}
                  >
                    <Link
                      href={`/leagues/${leagueId}/matchup/${matchup.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between">
                        {/* Team 1 */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium ${
                              team1Won ? 'text-green-400' : 'text-white'
                            }`}>
                              {matchup.team1?.name || 'TBD'}
                            </p>
                            {team1Won && <Trophy className="h-4 w-4 text-yellow-400" />}
                          </div>
                          <p className="text-sm text-gray-400">
                            {matchup.team1?.user?.displayName || matchup.team1?.user?.username}
                          </p>
                        </div>

                        {/* Score */}
                        <div className="px-6 text-center">
                          <div className="flex items-center gap-3">
                            <span className={`text-2xl font-bold ${
                              team1Won ? 'text-green-400' : 'text-white'
                            }`}>
                              {matchup.isCompleted || period.isActive
                                ? formatPoints(matchup.team1Score)
                                : '-'}
                            </span>
                            <span className="text-gray-500">vs</span>
                            <span className={`text-2xl font-bold ${
                              team2Won ? 'text-green-400' : 'text-white'
                            }`}>
                              {matchup.isCompleted || period.isActive
                                ? formatPoints(matchup.team2Score)
                                : '-'}
                            </span>
                          </div>
                          {matchup.isCompleted && (
                            <p className="text-xs text-gray-500 mt-1">
                              {isTie ? 'Tie' : 'Final'}
                            </p>
                          )}
                        </div>

                        {/* Team 2 */}
                        <div className="flex-1 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {team2Won && <Trophy className="h-4 w-4 text-yellow-400" />}
                            <p className={`font-medium ${
                              team2Won ? 'text-green-400' : 'text-white'
                            }`}>
                              {matchup.team2?.name || 'BYE'}
                            </p>
                          </div>
                          <p className="text-sm text-gray-400">
                            {matchup.team2?.user?.displayName || matchup.team2?.user?.username || ''}
                          </p>
                        </div>
                      </div>
                    </Link>
                    
                    {/* Simulate button for individual matchup */}
                    {canSimulate && !matchup.isCompleted && (
                      <div className="mt-3 pt-3 border-t border-gray-700 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSimulateOne(matchup.id);
                          }}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Simulate
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period Leaderboard */}
      {standings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Period Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                    <th className="pb-3 pr-4">Rank</th>
                    <th className="pb-3 pr-4">Team</th>
                    <th className="pb-3 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((team: any, index: number) => (
                    <tr
                      key={team.id}
                      className={`border-b border-gray-800 ${
                        team.id === userTeam?.id ? 'bg-primary-900/20' : ''
                      }`}
                    >
                      <td className="py-3 pr-4 text-white font-medium">
                        {index === 0 && <Trophy className="h-4 w-4 text-yellow-400 inline mr-1" />}
                        {index + 1}
                      </td>
                      <td className="py-3 pr-4 text-white">{team.name}</td>
                      <td className="py-3 text-right text-white font-medium">
                        {formatPoints(team.periodPoints || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
