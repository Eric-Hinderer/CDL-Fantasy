import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { makePick } from '../routes/draft.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export function setupDraftSocket(io: Server): void {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.userId} connected to draft socket`);

    // Join draft room
    socket.on('join-draft', async (leagueId: string) => {
      try {
        // Verify user is in this league
        const team = await prisma.fantasyTeam.findFirst({
          where: {
            leagueId,
            userId: socket.userId,
          },
        });

        if (!team) {
          socket.emit('error', { message: 'Not a member of this league' });
          return;
        }

        socket.join(`draft:${leagueId}`);
        console.log(`User ${socket.userId} joined draft room for league ${leagueId}`);

        // Send current draft state
        const draftSettings = await prisma.draftSettings.findUnique({
          where: { leagueId },
          include: {
            picks: {
              include: {
                player: {
                  include: {
                    cdlTeam: {
                      select: { name: true, abbreviation: true },
                    },
                  },
                },
                fantasyTeam: {
                  include: {
                    user: {
                      select: { username: true, displayName: true },
                    },
                  },
                },
              },
              orderBy: { pickNumber: 'asc' },
            },
            league: {
              include: {
                fantasyTeams: {
                  include: {
                    user: {
                      select: { id: true, username: true, displayName: true },
                    },
                  },
                },
              },
            },
          },
        });

        socket.emit('draft-state', draftSettings);
      } catch (error) {
        console.error('Error joining draft:', error);
        socket.emit('error', { message: 'Failed to join draft' });
      }
    });

    // Leave draft room
    socket.on('leave-draft', (leagueId: string) => {
      socket.leave(`draft:${leagueId}`);
      console.log(`User ${socket.userId} left draft room for league ${leagueId}`);
    });

    // Make a pick
    socket.on('make-pick', async (data: { leagueId: string; playerId: string }) => {
      try {
        const { leagueId, playerId } = data;

        // Make the pick
        const result = await makePick(leagueId, socket.userId!, playerId, false);

        // Broadcast to all users in draft room
        io.to(`draft:${leagueId}`).emit('pick-made', {
          pick: result.pick,
          isComplete: result.isComplete,
        });

        if (result.isComplete) {
          io.to(`draft:${leagueId}`).emit('draft-complete');
        }
      } catch (error: any) {
        console.error('Error making pick:', error);
        socket.emit('error', { message: error.message || 'Failed to make pick' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected from draft socket`);
    });
  });
}

// Function to broadcast draft updates (called from jobs)
export function broadcastDraftUpdate(io: Server, leagueId: string, event: string, data: any): void {
  io.to(`draft:${leagueId}`).emit(event, data);
}
