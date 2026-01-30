import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  databaseUrl: z.string(),
  redisUrl: z.string().default('redis://localhost:6379'),
  jwtSecret: z.string().min(32),
  jwtExpiresIn: z.string().default('7d'),
  frontendUrl: z.string().default('http://localhost:3000'),
  statsProvider: z.enum(['demo', 'breakingpoint', 'cdl-api']).default('demo'),
});

const parsedConfig = configSchema.safeParse({
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  frontendUrl: process.env.FRONTEND_URL,
  statsProvider: process.env.STATS_PROVIDER,
});

if (!parsedConfig.success) {
  console.error('❌ Invalid environment variables:', parsedConfig.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsedConfig.data;

// Scoring rules type
export interface ScoringRules {
  killPoints: number;
  deathPoints: number;
  assistPoints: number;
  damagePoints: number;  // Per 100 damage
  objectiveTimePoints: number;  // Per second
  bombPlantPoints: number;
  bombDefusePoints: number;
  firstBloodPoints: number;
}

export const DEFAULT_SCORING_RULES: ScoringRules = {
  killPoints: 1.0,
  deathPoints: -0.5,
  assistPoints: 0.25,
  damagePoints: 0.01,
  objectiveTimePoints: 0.02,
  bombPlantPoints: 2.0,
  bombDefusePoints: 2.0,
  firstBloodPoints: 1.5,
};
