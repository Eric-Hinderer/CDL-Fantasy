'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { leaguesApi, standingsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Trophy, Users, Calendar, Settings, Copy } from 'lucide-react';
import { formatPoints, formatDate } from '@/lib/utils';
import { useState } from 'react';

export default function LeagueDetailPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const { data: leagueData, isLoading } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => leaguesApi.getLeague(leagueId),
  });

  const { data: standingsData } = useQuery({
    queryKey: ['standings', leagueId],
    queryFn: () => standingsApi.getStandings(leagueId),
    enabled: !!leagueId,
  });

  const league = leagueData?.league;
  const userTeam = leagueData?.userTeam;
  const standings = standingsData?.standings || [];

  const copyJoinCode = () => {
    navigator.clipboard.writeText(league?.joinCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-gray-800 rounded"></div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <h3 className="text-lg font-medium text-white">League not found</h3>
        </CardContent>
      </Card>
    );
  }

  const activePeriod = league.scoringPeriods?.find((p: any) => p.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{league.name}</h1>
          <div className="flex items-center gap-4 mt-2">
            <span
              className={`text-xs px-2 py-1 rounded ${
                league.status === 'IN_SEASON'
                  ? 'bg-green-900 text-green-300'
                  : league.status === 'DRAFTING'
                  ? 'bg-yellow-900 text-yellow-300'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {league.status.replace('_', ' ')}
            </span>
            <button
              onClick={copyJoinCode}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Copy size={14} />
              {copied ? 'Copied!' : `Code: ${league.joinCode}`}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {userTeam && activePeriod && (
            <Link href={`/leagues/${leagueId}/lineup`}>
              <Button>Set Lineup</Button>
            </Link>
          )}
          {league.status === 'PRE_DRAFT' && league.ownerId === user?.id && (
            <Link href={`/leagues/${leagueId}/draft`}>
              <Button variant="secondary">Manage Draft</Button>
            </Link>
          )}
          {league.status === 'DRAFTING' && (
            <Link href={`/leagues/${leagueId}/draft`}>
              <Button>Go to Draft</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-900 rounded-lg">
                <Users className="h-5 w-5 text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Teams</p>
                <p className="text-xl font-bold text-white">
                  {league.fantasyTeams.length}/{league.maxTeams}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-900 rounded-lg">
                <Trophy className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Roster Size</p>
                <p className="text-xl font-bold text-white">
                  {league.starterCount} starters / {league.rosterSize} total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-900 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Period</p>
                <p className="text-xl font-bold text-white">
                  {activePeriod?.name || 'None'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        {userTeam && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-900 rounded-lg">
                  <Trophy className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Your Record</p>
                  <p className="text-xl font-bold text-white">
                    {userTeam.wins}-{userTeam.losses}
                    {userTeam.ties > 0 && `-${userTeam.ties}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Standings */}
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="pb-3 pr-4">Rank</th>
                  <th className="pb-3 pr-4">Team</th>
                  <th className="pb-3 pr-4">Owner</th>
                  <th className="pb-3 pr-4 text-center">W</th>
                  <th className="pb-3 pr-4 text-center">L</th>
                  <th className="pb-3 pr-4 text-center">T</th>
                  <th className="pb-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team: any) => (
                  <tr
                    key={team.id}
                    className={`border-b border-gray-800 ${
                      team.id === userTeam?.id ? 'bg-primary-900/20' : ''
                    }`}
                  >
                    <td className="py-3 pr-4 text-white font-medium">{team.rank}</td>
                    <td className="py-3 pr-4 text-white">{team.name}</td>
                    <td className="py-3 pr-4 text-gray-400">
                      {team.user.displayName || team.user.username}
                    </td>
                    <td className="py-3 pr-4 text-center text-green-400">{team.wins}</td>
                    <td className="py-3 pr-4 text-center text-red-400">{team.losses}</td>
                    <td className="py-3 pr-4 text-center text-gray-400">{team.ties}</td>
                    <td className="py-3 text-right text-white">
                      {formatPoints(team.totalPoints)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Periods */}
      {league.scoringPeriods?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scoring Periods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {league.scoringPeriods.map((period: any) => (
                <Link
                  key={period.id}
                  href={`/leagues/${leagueId}/period/${period.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  <div>
                    <p className="text-white font-medium">{period.name}</p>
                    <p className="text-sm text-gray-400">
                      {formatDate(period.startDate)} - {formatDate(period.endDate)}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      period.isActive
                        ? 'bg-green-900 text-green-300'
                        : period.isCompleted
                        ? 'bg-gray-700 text-gray-300'
                        : 'bg-blue-900 text-blue-300'
                    }`}
                  >
                    {period.isActive ? 'Active' : period.isCompleted ? 'Completed' : 'Upcoming'}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
