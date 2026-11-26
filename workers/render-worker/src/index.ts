import { YBVideoDocumentSchema, type YBVideoDocument, computeTotalDurationSeconds } from '@youbellkey/video-schema';
import { getTemplateSpec } from '@youbellkey/video-templates';

export interface RenderPlanSummary {
  title: string;
  locale: string;
  sceneCount: number;
  totalDurationSeconds: number;
  templatesUsed: string[];
}

/**
 * Validates a YB Video Document against schema and V1 template registry
 * before invoking HyperFrames in Phase 3.
 */
export function validateAndSummarizeRenderPlan(rawDocument: unknown): RenderPlanSummary {
  const doc: YBVideoDocument = YBVideoDocumentSchema.parse(rawDocument);
  const templatesUsed = [...new Set(doc.scenes.map((scene) => getTemplateSpec(scene.templateId).id))];

  return {
    title: doc.project.title,
    locale: doc.project.locale,
    sceneCount: doc.scenes.length,
    totalDurationSeconds: computeTotalDurationSeconds(doc),
    templatesUsed,
  };
}
