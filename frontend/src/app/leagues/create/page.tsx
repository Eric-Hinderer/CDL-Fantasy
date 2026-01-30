'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { leaguesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function CreateLeaguePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    maxTeams: 8,
    rosterSize: 6,
    starterCount: 4,
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: () => leaguesApi.createLeague(formData),
    onSuccess: (data) => {
      router.push(`/leagues/${data.league.id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create league');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.starterCount > formData.rosterSize) {
      setError('Starter count cannot exceed roster size');
      return;
    }

    createMutation.mutate();
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create a League</CardTitle>
          <CardDescription>
            Set up your fantasy CDL league and invite friends to join
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
              label="League Name"
              placeholder="My CDL League"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Max Teams
                </label>
                <select
                  className="w-full h-10 rounded-md border border-gray-600 bg-gray-800 px-3 text-white"
                  value={formData.maxTeams}
                  onChange={(e) =>
                    setFormData({ ...formData, maxTeams: parseInt(e.target.value) })
                  }
                >
                  {[4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Roster Size
                </label>
                <select
                  className="w-full h-10 rounded-md border border-gray-600 bg-gray-800 px-3 text-white"
                  value={formData.rosterSize}
                  onChange={(e) =>
                    setFormData({ ...formData, rosterSize: parseInt(e.target.value) })
                  }
                >
                  {[4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Starters
                </label>
                <select
                  className="w-full h-10 rounded-md border border-gray-600 bg-gray-800 px-3 text-white"
                  value={formData.starterCount}
                  onChange={(e) =>
                    setFormData({ ...formData, starterCount: parseInt(e.target.value) })
                  }
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create League'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
