'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { leaguesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Trophy, Plus, Users } from 'lucide-react';
import { formatPoints } from '@/lib/utils';

export default function LeaguesPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['leagues'],
    queryFn: leaguesApi.getMyLeagues,
  });

  const leagues = data?.leagues || [];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-800 rounded"></div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Leagues</h1>
          <p className="text-gray-400 mt-1">Manage your fantasy CDL leagues</p>
        </div>
        <div className="flex gap-2">
          <Link href="/leagues/join">
            <Button variant="outline">
              <Users size={16} className="mr-2" />
              Join League
            </Button>
          </Link>
          <Link href="/leagues/create">
            <Button>
              <Plus size={16} className="mr-2" />
              Create League
            </Button>
          </Link>
        </div>
      </div>

      {leagues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No leagues yet</h3>
            <p className="text-gray-400 mb-4">
              Create your first league or join one with an invite code
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {leagues.map((league: any) => {
            const userTeam = league.fantasyTeams.find(
              (t: any) => t.user.id === user?.id
            );

            return (
              <Link key={league.id} href={`/leagues/${league.id}`}>
                <Card className="h-full hover:border-gray-700 transition-colors cursor-pointer">
                  <CardHeader>
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
                    <div className="space-y-2 text-sm">
                      {userTeam && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Your Team</span>
                            <span className="text-white">{userTeam.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Record</span>
                            <span className="text-white">
                              {userTeam.wins}-{userTeam.losses}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Points</span>
                            <span className="text-white">
                              {formatPoints(userTeam.totalPoints)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between pt-2 border-t border-gray-800">
                        <span className="text-gray-400">Teams</span>
                        <span className="text-white">
                          {league._count.fantasyTeams}/{league.maxTeams}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
