'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { draftApi, leaguesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDateTime } from '@/lib/utils';
import { Clock, User, Search, AlertCircle, CheckCircle, Trophy } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Player {
  id: string;
  gamerTag: string;
  role: string;
  cdlTeam: { name: string; abbreviation: string };
  averageDraftPosition?: number;
}

interface DraftPick {
  id: string;
  pickNumber: number;
  player: Player;
  fantasyTeam: {
    id: string;
    name: string;
    user: { username: string; displayName?: string };
  };
}

interface FantasyTeam {
  id: string;
  name: string;
  user: { id: string; username: string; displayName?: string };
}

export default function DraftPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id as string;
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Get league data
  const { data: leagueData } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => leaguesApi.getLeague(leagueId),
  });

  // Get draft state
  const { data: draftData, isLoading, refetch } = useQuery({
    queryKey: ['draft', leagueId],
    queryFn: () => draftApi.getDraftState(leagueId),
    refetchInterval: 5000, // Poll every 5 seconds as backup
  });

  const league = leagueData?.league;
  const draftSettings = draftData?.draftSettings;
  const availablePlayers = draftData?.availablePlayers || [];
  const currentTeam = draftData?.currentTeam;
  const pickDeadline = draftData?.pickDeadline;
  const userTeam = leagueData?.userTeam;

  // Request notification permission on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Socket connection
  useEffect(() => {
    if (!token || !leagueId) return;

    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join-draft', leagueId);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('draft-state', () => {
      refetch();
    });

    newSocket.on('draft-started', (data: any) => {
      console.log('Draft started!', data);
      refetch();
      // Show notification
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Draft Started!', { body: 'The draft is now live. Join now!' });
      }
    });

    newSocket.on('pick-made', () => {
      refetch();
    });

    newSocket.on('draft-complete', () => {
      refetch();
    });

    newSocket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave-draft', leagueId);
      newSocket.disconnect();
    };
  }, [token, leagueId, refetch]);

  // Start draft mutation
  const startDraftMutation = useMutation({
    mutationFn: () => draftApi.startDraft(leagueId),
    onSuccess: () => {
      refetch();
      // Also emit via socket to notify other users
      if (socket?.connected) {
        socket.emit('start-draft', leagueId);
      }
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || error.response?.data?.message || 'Failed to start draft');
    },
  });

  // Make pick mutation
  const makePickMutation = useMutation({
    mutationFn: (playerId: string) => {
      if (socket?.connected) {
        socket.emit('make-pick', { leagueId, playerId });
        return Promise.resolve();
      }
      return draftApi.makePick(leagueId, playerId);
    },
    onSuccess: () => {
      setSelectedPlayerId(null);
      refetch();
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || error.response?.data?.message || 'Failed to make pick');
    },
  });

  const isMyTurn = currentTeam?.userId === user?.id;
  const isLeagueOwner = league?.ownerId === user?.id;
  const isDraftComplete = draftSettings?.status === 'COMPLETED';
  const isDraftInProgress = draftSettings?.status === 'IN_PROGRESS';
  const canStartDraft = draftSettings?.status === 'NOT_STARTED' && isLeagueOwner;

  // Filter players
  const filteredPlayers = availablePlayers.filter((player: Player) =>
    player.gamerTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.cdlTeam?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Draft order
  const draftOrder = draftSettings?.league?.fantasyTeams || [];
  const picks = draftSettings?.picks || [];
  const currentPickNumber = picks.length + 1;
  const totalPicks = draftOrder.length * (league?.rosterSize || 6);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-gray-800 rounded"></div>
        <div className="h-96 bg-gray-800 rounded"></div>
      </div>
    );
  }

  if (!draftSettings) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <h3 className="text-lg font-medium text-white">Draft not set up yet</h3>
          <p className="text-gray-400 mt-2">The league commissioner needs to configure draft settings.</p>
        </CardContent>
      </Card>
    );
  }

  if (isDraftComplete) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Draft Complete!</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Draft Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {picks.map((pick: DraftPick) => (
                <div
                  key={pick.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 font-mono w-8">#{pick.pickNumber}</span>
                    <div>
                      <p className="font-medium text-white">{pick.player.gamerTag}</p>
                      <p className="text-sm text-gray-400">
                        {pick.player.cdlTeam?.name} · {pick.player.role}
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-400 text-sm">
                    {pick.fantasyTeam.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => router.push(`/leagues/${leagueId}`)}>
          Back to League
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isDraftInProgress ? 'Live Draft' : 'Draft Room'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        {canStartDraft && (
          <Button 
            onClick={() => startDraftMutation.mutate()}
            disabled={startDraftMutation.isPending}
          >
            {startDraftMutation.isPending ? 'Starting...' : 'Start Draft'}
          </Button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-200">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">×</button>
        </div>
      )}

      {/* Pre-draft waiting */}
      {!isDraftInProgress && !isDraftComplete && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white">Waiting for Draft to Start</h3>
            <p className="text-gray-400 mt-2">
              {isLeagueOwner
                ? 'You can start the draft when all teams are ready.'
                : 'The league commissioner will start the draft soon.'}
            </p>
            <p className="text-sm text-gray-500 mt-4">
              {draftOrder.length} teams ready
            </p>
          </CardContent>
        </Card>
      )}

      {/* Draft in progress */}
      {isDraftInProgress && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Draft Status */}
          <div className="lg:col-span-2 space-y-4">
            {/* Current Pick */}
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Pick {currentPickNumber} of {totalPicks}</p>
                    <p className="text-xl font-bold text-white mt-1">
                      {currentTeam?.name || 'Waiting...'}
                    </p>
                    {pickDeadline && (
                      <p className="text-sm text-gray-400 mt-1">
                        Deadline: {formatDateTime(pickDeadline)}
                      </p>
                    )}
                  </div>
                  {isMyTurn && (
                    <div className="p-3 bg-green-900/50 rounded-lg border border-green-700">
                      <p className="text-green-300 font-medium">Your Pick!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Available Players */}
            <Card>
              <CardHeader>
                <CardTitle>Available Players</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredPlayers.map((player: Player) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedPlayerId === player.id
                          ? 'bg-primary-900/50 border border-primary-700'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                      onClick={() => isMyTurn && setSelectedPlayerId(player.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                          <span className="text-sm font-bold">
                            {player.cdlTeam?.abbreviation || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{player.gamerTag}</p>
                          <p className="text-sm text-gray-400">
                            {player.cdlTeam?.name} · {player.role}
                          </p>
                        </div>
                      </div>
                      {player.averageDraftPosition && (
                        <span className="text-sm text-gray-400">
                          ADP: {player.averageDraftPosition.toFixed(1)}
                        </span>
                      )}
                    </div>
                  ))}
                  {filteredPlayers.length === 0 && (
                    <p className="text-gray-400 text-center py-4">No players found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Draft Button */}
            {isMyTurn && selectedPlayerId && (
              <Button
                className="w-full"
                onClick={() => makePickMutation.mutate(selectedPlayerId)}
                disabled={makePickMutation.isPending}
              >
                {makePickMutation.isPending ? 'Drafting...' : 'Draft Selected Player'}
              </Button>
            )}
          </div>

          {/* Draft Log */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Draft Order</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {draftOrder.map((team: FantasyTeam, index: number) => (
                    <div
                      key={team.id}
                      className={`flex items-center gap-2 p-2 rounded ${
                        currentTeam?.id === team.id
                          ? 'bg-primary-900/50 border border-primary-700'
                          : 'bg-gray-800'
                      }`}
                    >
                      <span className="text-gray-400 font-mono w-6">{index + 1}.</span>
                      <span className="text-white">{team.name}</span>
                      {team.user.id === user?.id && (
                        <span className="text-xs text-primary-400">(You)</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Picks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {picks.slice(-10).reverse().map((pick: DraftPick) => (
                    <div key={pick.id} className="flex items-center gap-2 p-2 rounded bg-gray-800">
                      <span className="text-gray-400 font-mono w-6">#{pick.pickNumber}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white truncate">{pick.player.gamerTag}</p>
                        <p className="text-xs text-gray-400">{pick.fantasyTeam.name}</p>
                      </div>
                    </div>
                  ))}
                  {picks.length === 0 && (
                    <p className="text-gray-400 text-center py-4">No picks yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
