import type { WorkspaceRow } from '@youbellkey/database';
import { createSupabaseServerClient } from './supabase-server';

export interface AuthenticatedContext {
  userId: string;
  userEmail: string | null;
  workspace: WorkspaceRow;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}

export async function getAuthenticatedWorkspace(): Promise<AuthenticatedContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: existingWorkspaces, error: listError } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1);

  if (listError) {
    throw new Error(`Failed to load workspace: ${listError.message}`);
  }

  if (existingWorkspaces && existingWorkspaces.length > 0) {
    return {
      userId: user.id,
      userEmail: user.email ?? null,
      workspace: existingWorkspaces[0] as WorkspaceRow,
      supabase,
    };
  }

  // Provision initial personal workspace on first sign-in.
  const { data: created, error: createError } = await supabase
    .from('workspaces')
    .insert({
      owner_user_id: user.id,
      name: 'Youbellkey Personal Studio',
      default_locale: 'id-ID',
      default_timezone: 'Asia/Jakarta',
    })
    .select('*')
    .single();

  if (createError || !created) {
    throw new Error(`Failed to provision workspace: ${createError?.message ?? 'unknown error'}`);
  }

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    workspace: created as WorkspaceRow,
    supabase,
  };
}
