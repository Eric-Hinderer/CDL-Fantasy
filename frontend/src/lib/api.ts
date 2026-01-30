import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    return res.data;
  },
  signup: async (data: { email: string; username: string; password: string; displayName?: string }) => {
    const res = await api.post('/api/auth/signup', data);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/api/auth/me');
    return res.data;
  },
};

// Leagues API
export const leaguesApi = {
  getMyLeagues: async () => {
    const res = await api.get('/api/leagues');
    return res.data;
  },
  getLeague: async (id: string) => {
    const res = await api.get(`/api/leagues/${id}`);
    return res.data;
  },
  createLeague: async (data: { name: string; maxTeams?: number; rosterSize?: number; starterCount?: number }) => {
    const res = await api.post('/api/leagues', data);
    return res.data;
  },
  joinLeague: async (joinCode: string, teamName: string) => {
    const res = await api.post('/api/leagues/join', { joinCode, teamName });
    return res.data;
  },
  getScoringPeriods: async (leagueId: string) => {
    const res = await api.get(`/api/leagues/${leagueId}/scoring-periods`);
    return res.data;
  },
};

// Players API
export const playersApi = {
  getPlayers: async (params?: { teamId?: string; search?: string; available?: boolean; leagueId?: string }) => {
    const res = await api.get('/api/players', { params });
    return res.data;
  },
  getPlayer: async (id: string) => {
    const res = await api.get(`/api/players/${id}`);
    return res.data;
  },
};

// Lineups API
export const lineupsApi = {
  getLineup: async (teamId: string, periodId: string) => {
    const res = await api.get(`/api/lineups/team/${teamId}/period/${periodId}`);
    return res.data;
  },
  setLineup: async (teamId: string, periodId: string, slots: { rosterSlotId: string; position: number; isStarter: boolean }[]) => {
    const res = await api.put(`/api/lineups/team/${teamId}/period/${periodId}`, { slots });
    return res.data;
  },
  getRoster: async (teamId: string) => {
    const res = await api.get(`/api/lineups/roster/${teamId}`);
    return res.data;
  },
};

// Matchups API
export const matchupsApi = {
  getLeagueMatchups: async (leagueId: string, periodId?: string) => {
    const res = await api.get(`/api/matchups/league/${leagueId}`, { params: { periodId } });
    return res.data;
  },
  getMatchup: async (matchupId: string) => {
    const res = await api.get(`/api/matchups/${matchupId}`);
    return res.data;
  },
  getCurrentMatchup: async (teamId: string) => {
    const res = await api.get(`/api/matchups/team/${teamId}/current`);
    return res.data;
  },
};

// Standings API
export const standingsApi = {
  getStandings: async (leagueId: string) => {
    const res = await api.get(`/api/standings/league/${leagueId}`);
    return res.data;
  },
  getPeriodStandings: async (leagueId: string, periodId: string) => {
    const res = await api.get(`/api/standings/league/${leagueId}/period/${periodId}`);
    return res.data;
  },
};

// Draft API
export const draftApi = {
  getDraftState: async (leagueId: string) => {
    const res = await api.get(`/api/draft/league/${leagueId}`);
    return res.data;
  },
  startDraft: async (leagueId: string) => {
    const res = await api.post(`/api/draft/league/${leagueId}/start`);
    return res.data;
  },
  makePick: async (leagueId: string, playerId: string) => {
    const res = await api.post(`/api/draft/league/${leagueId}/pick`, { playerId });
    return res.data;
  },
};
