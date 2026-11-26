import type { WorkspaceRow } from '@youbellkey/database';
import { createSupabaseAdminClient } from '@youbellkey/database';
import { createSupabaseServerClient } from './supabase-server';

export interface AuthenticatedContext {
  userId: string;
  userEmail: string | null;
  workspace: WorkspaceRow;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}

export async function getAuthenticatedWorkspace(): Promise<AuthenticatedContext | null> {
  // 1. Verify user identity via SSR anon client (reads cookies / JWT)
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // 2. Use ADMIN client for all DB workspace operations (bypasses RLS).
  //    This is safe because we already authenticated the user above.
  //    Manual tenant filter: .eq('owner_user_id', user.id)
  const admin = createSupabaseAdminClient();

  const { data: existingWorkspaces, error: listError } = await admin
    .from('workspaces')
    .select('*')
    .eq('owner_user_id', user.id)
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

  // 3. Auto-provision personal workspace on first sign-in (admin client, server-trusted).
  const { data: created, error: createError } = await admin
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
