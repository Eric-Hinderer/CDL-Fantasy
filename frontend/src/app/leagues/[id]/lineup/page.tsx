'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { leaguesApi, lineupsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface LineupSlot {
  rosterSlotId: string;
  position: number;
  isStarter: boolean;
  player: {
    gamerTag: string;
    role: string;
    cdlTeam: { name: string; abbreviation: string };
  };
}

export default function LineupPage() {
  const params = useParams();
  const leagueId = params.id as string;
  const queryClient = useQueryClient();
  const [slots, setSlots] = useState<LineupSlot[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get league data to find user's team
  const { data: leagueData } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => leaguesApi.getLeague(leagueId),
  });

  const userTeam = leagueData?.userTeam;
  const league = leagueData?.league;

  // Find active scoring period
  const activePeriod = league?.scoringPeriods?.find((p: any) => p.isActive);

  // Get lineup data
  const { data: lineupData, isLoading } = useQuery({
    queryKey: ['lineup', userTeam?.id, activePeriod?.id],
    queryFn: () => lineupsApi.getLineup(userTeam.id, activePeriod.id),
    enabled: !!userTeam?.id && !!activePeriod?.id,
  });

  // Initialize slots from lineup or roster
  useEffect(() => {
    if (lineupData) {
      if (lineupData.lineup?.slots) {
        // Use existing lineup
        setSlots(
          lineupData.lineup.slots.map((s: any) => ({
            rosterSlotId: s.rosterSlot.id,
            position: s.position,
            isStarter: s.isStarter,
            player: s.rosterSlot.player,
          }))
        );
      } else if (lineupData.roster) {
        // Create default lineup from roster
        setSlots(
          lineupData.roster.map((r: any, i: number) => ({
            rosterSlotId: r.id,
            position: i,
            isStarter: i < (league?.starterCount || 4),
            player: r.player,
          }))
        );
      }
    }
  }, [lineupData, league?.starterCount]);

  // Save lineup mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      lineupsApi.setLineup(
        userTeam.id,
        activePeriod.id,
        slots.map((s) => ({
          rosterSlotId: s.rosterSlotId,
          position: s.position,
          isStarter: s.isStarter,
        }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineup', userTeam?.id, activePeriod?.id] });
      setHasChanges(false);
      setErrorMessage(null);
      setSuccessMessage('Lineup saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to save lineup';
      setErrorMessage(message);
      setSuccessMessage(null);
    },
  });

  const toggleStarter = (rosterSlotId: string) => {
    const starterCount = league?.starterCount || 4;
    const currentStarters = slots.filter((s) => s.isStarter).length;
    const slot = slots.find((s) => s.rosterSlotId === rosterSlotId);

    if (!slot) return;

    // If making them a starter, check limit
    if (!slot.isStarter && currentStarters >= starterCount) {
      return; // Already at max starters
    }

    setSlots((prev) =>
      prev.map((s) =>
        s.rosterSlotId === rosterSlotId ? { ...s, isStarter: !s.isStarter } : s
      )
    );
    setHasChanges(true);
  };

  const isLocked = activePeriod && new Date() > new Date(activePeriod.lockTime);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-gray-800 rounded"></div>
        <div className="h-64 bg-gray-800 rounded"></div>
      </div>
    );
  }

  if (!userTeam) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-400">You don't have a team in this league</p>
        </CardContent>
      </Card>
    );
  }

  if (!activePeriod) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-400">No active scoring period</p>
        </CardContent>
      </Card>
    );
  }

  const starters = slots.filter((s) => s.isStarter);
  const bench = slots.filter((s) => !s.isStarter);
  const starterCount = league?.starterCount || 4;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Set Lineup</h1>
          <p className="text-gray-400 mt-1">
            {activePeriod.name} - Locks {formatDateTime(activePeriod.lockTime)}
          </p>
        </div>
        <Button
          onClick={() => {
            setErrorMessage(null);
            saveMutation.mutate();
          }}
          disabled={!hasChanges || isLocked || saveMutation.isPending || starters.length !== starterCount}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Lineup'}
        </Button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-200">{errorMessage}</p>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-900/50 border border-green-700 rounded-lg flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
          <p className="text-green-200">{successMessage}</p>
        </div>
      )}

      {/* Starter Count Warning */}
      {starters.length !== starterCount && (
        <div className="p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-200">
            You must have exactly {starterCount} starters. Currently have {starters.length}.
          </p>
        </div>
      )}

      {isLocked && (
        <div className="p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg">
          <p className="text-yellow-200">
            Lineup is locked for this scoring period
          </p>
        </div>
      )}

      {/* Starters */}
      <Card>
        <CardHeader>
          <CardTitle>
            Starters ({starters.length}/{league?.starterCount || 4})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {starters.length === 0 ? (
              <p className="text-gray-400 text-center py-4">
                Click on bench players to add them as starters
              </p>
            ) : (
              starters.map((slot) => (
                <div
                  key={slot.rosterSlotId}
                  className="flex items-center justify-between p-3 rounded-lg bg-green-900/20 border border-green-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-sm font-bold">
                        {slot.player.cdlTeam?.abbreviation || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{slot.player.gamerTag}</p>
                      <p className="text-sm text-gray-400">
                        {slot.player.cdlTeam?.name} · {slot.player.role}
                      </p>
                    </div>
                  </div>
                  {!isLocked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleStarter(slot.rosterSlotId)}
                    >
                      Move to Bench
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bench */}
      <Card>
        <CardHeader>
          <CardTitle>Bench ({bench.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {bench.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No players on bench</p>
            ) : (
              bench.map((slot) => (
                <div
                  key={slot.rosterSlotId}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-sm font-bold">
                        {slot.player.cdlTeam?.abbreviation || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{slot.player.gamerTag}</p>
                      <p className="text-sm text-gray-400">
                        {slot.player.cdlTeam?.name} · {slot.player.role}
                      </p>
                    </div>
                  </div>
                  {!isLocked && starters.length < (league?.starterCount || 4) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toggleStarter(slot.rosterSlotId)}
                    >
                      Start
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
