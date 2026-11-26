export type MediaAssetKind = 'voiceover' | 'image' | 'clip' | 'render-mp4' | 'thumbnail';

export function buildWorkspaceR2Key(
  workspaceId: string,
  projectId: string,
  kind: MediaAssetKind,
  filename: string,
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `workspaces/${workspaceId}/projects/${projectId}/${kind}/${safeName}`;
}
