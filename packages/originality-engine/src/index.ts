export interface OriginalityReport {
  trigramOverlap: number;
  verdict: 'PASS' | 'REVIEW_REQUIRED';
  reasons: string[];
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function buildTrigrams(words: string[]): Set<string> {
  const trigrams = new Set<string>();
  if (words.length < 3) {
    if (words.length > 0) trigrams.add(words.join(' '));
    return trigrams;
  }
  for (let i = 0; i <= words.length - 3; i++) {
    trigrams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return trigrams;
}

/**
 * Evaluates lexical overlap between a generated script and a reference transcript
 * to guard against near-copying or repetitive Shorts output.
 */
export function evaluateOriginality(
  referenceText: string,
  candidateText: string,
  maxAllowedOverlap = 0.25,
): OriginalityReport {
  const refTrigrams = buildTrigrams(normalizeWords(referenceText));
  const candTrigrams = buildTrigrams(normalizeWords(candidateText));

  if (refTrigrams.size === 0 || candTrigrams.size === 0) {
    return { trigramOverlap: 0, verdict: 'PASS', reasons: [] };
  }

  let intersection = 0;
  for (const gram of candTrigrams) {
    if (refTrigrams.has(gram)) intersection++;
  }

  const trigramOverlap = Number((intersection / candTrigrams.size).toFixed(4));
  const reasons: string[] = [];

  if (trigramOverlap > maxAllowedOverlap) {
    reasons.push(
      `Trigram overlap ${(trigramOverlap * 100).toFixed(1)}% exceeds threshold ${(maxAllowedOverlap * 100).toFixed(1)}%`,
    );
  }

  return {
    trigramOverlap,
    verdict: reasons.length === 0 ? 'PASS' : 'REVIEW_REQUIRED',
    reasons,
  };
}
