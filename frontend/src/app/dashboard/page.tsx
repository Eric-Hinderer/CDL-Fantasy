'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { leaguesApi, matchupsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Trophy, Users, Calendar, ChevronRight } from 'lucide-react';
import { formatPoints } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: leaguesData, isLoading } = useQuery({
    queryKey: ['leagues'],
    queryFn: leaguesApi.getMyLeagues,
  });

  const leagues = leaguesData?.leagues || [];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-800 rounded"></div>
        <div className="h-32 bg-gray-800 rounded"></div>
        <div className="h-32 bg-gray-800 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.displayName || user?.username}!
        </h1>
        <p className="text-gray-400 mt-1">Here's what's happening in your leagues</p>
      </div>

      {leagues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No leagues yet</h3>
            <p className="text-gray-400 mb-4">
              Create a league or join one with a code to get started
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/leagues/create">
                <Button>Create League</Button>
              </Link>
              <Link href="/leagues/join">
                <Button variant="outline">Join League</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {leagues.map((league: any) => {
            const userTeam = league.fantasyTeams.find(
              (t: any) => t.user.id === user?.id
            );

            return (
              <Card key={league.id} className="hover:border-gray-700 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{league.name}</CardTitle>
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
                  </div>
                </CardHeader>
                <CardContent>
                  {userTeam && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Your Team</span>
                        <span className="text-white font-medium">{userTeam.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Record</span>
                        <span className="text-white">
                          {userTeam.wins}-{userTeam.losses}
                          {userTeam.ties > 0 && `-${userTeam.ties}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Total Points</span>
                        <span className="text-white">{formatPoints(userTeam.totalPoints)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">League Size</span>
                        <span className="text-white">
                          {league._count.fantasyTeams}/{league.maxTeams} teams
                        </span>
                      </div>
                    </div>
                  )}

                  <Link href={`/leagues/${league.id}`}>
                    <Button variant="secondary" className="w-full mt-4">
                      View League
                      <ChevronRight size={16} className="ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {leagues.length > 0 && (
        <div className="flex gap-4">
          <Link href="/leagues/create">
            <Button variant="outline">
              <Users size={16} className="mr-2" />
              Create New League
            </Button>
          </Link>
          <Link href="/leagues/join">
            <Button variant="outline">
              <Calendar size={16} className="mr-2" />
              Join a League
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
