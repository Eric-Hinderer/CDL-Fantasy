'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { playersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Search } from 'lucide-react';

export default function PlayersPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['players', search],
    queryFn: () => playersApi.getPlayers({ search: search || undefined }),
  });

  const players = data?.players || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">CDL Players</h1>
        <p className="text-gray-400 mt-1">Browse all Call of Duty League players</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search players..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 bg-gray-800 rounded animate-pulse"></div>
          ))}
        </div>
      ) : players.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">No players found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {players.map((player: any) => (
            <Card key={player.id} className="hover:border-gray-700 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                    <span className="text-lg font-bold">
                      {player.cdlTeam?.abbreviation || '?'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{player.gamerTag}</h3>
                    <p className="text-sm text-gray-400">
                      {player.cdlTeam?.name || 'Free Agent'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-300">
                        {player.role || 'N/A'}
                      </span>
                      {player.averageDraftPosition && (
                        <span className="text-xs text-gray-500">
                          ADP: {player.averageDraftPosition}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
