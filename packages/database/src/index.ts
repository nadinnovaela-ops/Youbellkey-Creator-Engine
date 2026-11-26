export const INITIAL_MIGRATION_PATH = 'supabase/migrations/0001_initial_schema.sql';

export interface ClaimJobParams {
  workerId: string;
  capabilities: string[];
  leaseSeconds: number;
}
