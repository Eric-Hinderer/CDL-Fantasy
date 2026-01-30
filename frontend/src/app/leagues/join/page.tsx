'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { leaguesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function JoinLeaguePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');

  const joinMutation = useMutation({
    mutationFn: () => leaguesApi.joinLeague(joinCode.toUpperCase(), teamName),
    onSuccess: (data) => {
      router.push(`/leagues/${data.fantasyTeam.league.id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to join league');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (joinCode.length !== 6) {
      setError('Join code must be 6 characters');
      return;
    }

    joinMutation.mutate();
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Join a League</CardTitle>
          <CardDescription>
            Enter the league code to join an existing league
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-900/50 border border-red-700 text-red-200 text-sm">
                {error}
              </div>
            )}

            <Input
              label="League Code"
              placeholder="DEMO24"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
            />

            <Input
              label="Your Team Name"
              placeholder="My Fantasy Team"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? 'Joining...' : 'Join League'}
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center pt-2">
              Demo league code: DEMO24
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
