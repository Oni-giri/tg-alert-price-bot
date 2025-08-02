import dotenv from 'dotenv';
import { EnvSchema, EnvConfig } from '../types';

// Load environment variables
dotenv.config();

let config: EnvConfig;

try {
  config = EnvSchema.parse(process.env);
} catch (error) {
  console.error('Invalid environment configuration:', error);
  process.exit(1);
}

export { config };
