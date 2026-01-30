'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { matchupsApi, leaguesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatPoints, formatDate } from '@/lib/utils';
import { ArrowLeft, Trophy, User } from 'lucide-react';

interface LineupSlot {
  id: string;
  isStarter: boolean;
  totalPoints: number;
  rosterSlot: {
    player: {
      id: string;
      gamerTag: string;
      role: string;
      cdlTeam: { name: string; abbreviation: string };
    };
  };
}

interface TeamLineup {
  slots: LineupSlot[];
  starterPoints: number;
  benchPoints: number;
  totalPoints: number;
}

interface MatchupTeam {
  id: string;
  name: string;
  user: { username: string; displayName?: string; avatarUrl?: string };
}

export default function MatchupDetailPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const matchupId = params.matchupId as string;
  const { user } = useAuthStore();

  // Get matchup details
  const { data: matchupData, isLoading } = useQuery({
    queryKey: ['matchup', matchupId],
    queryFn: () => matchupsApi.getMatchup(matchupId),
  });

  // Get league for navigation
  const { data: leagueData } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => leaguesApi.getLeague(leagueId),
  });

  const matchup = matchupData?.matchup;
  const team1Lineup = matchupData?.team1Lineup;
  const team2Lineup = matchupData?.team2Lineup;
  const userTeam = leagueData?.userTeam;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-gray-800 rounded"></div>
        <div className="h-96 bg-gray-800 rounded"></div>
      </div>
    );
  }

  if (!matchup) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <h3 className="text-lg font-medium text-white">Matchup not found</h3>
          <Link href={`/leagues/${leagueId}`}>
            <Button className="mt-4">Back to League</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const team1: MatchupTeam = matchup.team1;
  const team2: MatchupTeam | null = matchup.team2;
  const scoringPeriod = matchup.scoringPeriod;
  
  const team1Won = matchup.isCompleted && matchup.winnerId === team1?.id;
  const team2Won = matchup.isCompleted && matchup.winnerId === team2?.id;
  const isTie = matchup.isCompleted && !matchup.winnerId;

  const renderTeamLineup = (team: MatchupTeam | null, lineup: TeamLineup | null, score: number, isWinner: boolean) => {
    if (!team) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">BYE Week</p>
          </CardContent>
        </Card>
      );
    }

    const starters = lineup?.slots?.filter(s => s.isStarter) || [];
    const bench = lineup?.slots?.filter(s => !s.isStarter) || [];

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                {team.user.avatarUrl ? (
                  <img src={team.user.avatarUrl} alt="" className="w-12 h-12 rounded-full" />
                ) : (
                  <User className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{team.name}</CardTitle>
                  {isWinner && <Trophy className="h-5 w-5 text-yellow-400" />}
                </div>
                <p className="text-sm text-gray-400">
                  {team.user.displayName || team.user.username}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-bold ${isWinner ? 'text-green-400' : 'text-white'}`}>
                {formatPoints(score)}
              </p>
              <p className="text-sm text-gray-400">Points</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Starters */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Starters</h4>
            <div className="space-y-2">
              {starters.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No lineup set</p>
              ) : (
                starters.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="text-sm font-bold">
                          {slot.rosterSlot.player.cdlTeam?.abbreviation || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {slot.rosterSlot.player.gamerTag}
                        </p>
                        <p className="text-sm text-gray-400">
                          {slot.rosterSlot.player.cdlTeam?.name} · {slot.rosterSlot.player.role}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">
                        {formatPoints(slot.totalPoints)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bench */}
          {bench.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">Bench</h4>
              <div className="space-y-2">
                {bench.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-500">
                          {slot.rosterSlot.player.cdlTeam?.abbreviation || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-400">
                          {slot.rosterSlot.player.gamerTag}
                        </p>
                        <p className="text-sm text-gray-500">
                          {slot.rosterSlot.player.role}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-500">
                        {formatPoints(slot.totalPoints)}
                      </p>
                      <p className="text-xs text-gray-600">(bench)</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href={`/leagues/${leagueId}/period/${scoringPeriod?.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Matchup Details</h1>
          <p className="text-gray-400 mt-1">
            {scoringPeriod?.name} · {formatDate(scoringPeriod?.startDate)}
          </p>
          {matchup.isCompleted && (
            <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
              {isTie ? 'Tied' : 'Final'}
            </span>
          )}
        </div>
      </div>

      {/* Score Summary */}
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-lg font-medium text-white">{team1?.name}</p>
              <p className={`text-4xl font-bold mt-2 ${team1Won ? 'text-green-400' : 'text-white'}`}>
                {formatPoints(matchup.team1Score)}
              </p>
            </div>
            <div className="text-gray-500 text-2xl">vs</div>
            <div className="text-center">
              <p className="text-lg font-medium text-white">{team2?.name || 'BYE'}</p>
              <p className={`text-4xl font-bold mt-2 ${team2Won ? 'text-green-400' : 'text-white'}`}>
                {team2 ? formatPoints(matchup.team2Score) : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Lineups */}
      <div className="grid gap-6 lg:grid-cols-2">
        {renderTeamLineup(team1, team1Lineup, matchup.team1Score, team1Won)}
        {renderTeamLineup(team2, team2Lineup, matchup.team2Score, team2Won)}
      </div>
    </div>
  );
}
