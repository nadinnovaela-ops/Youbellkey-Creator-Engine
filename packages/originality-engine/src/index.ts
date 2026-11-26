export interface OriginalityReport {
  trigramOverlap: number;
  verdict: 'PASS' | 'REVIEW_REQUIRED';
  reasons: string[];
}

export interface BatchCandidateReport {
  index: number;
  angle: string;
  referenceOverlap: number;
  maxPeerOverlap: number;
  originalityScore: number; // 0..1 (higher is more original)
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

function computeSetOverlap(baseTrigrams: Set<string>, candidateTrigrams: Set<string>): number {
  if (baseTrigrams.size === 0 || candidateTrigrams.size === 0) return 0;
  let intersection = 0;
  for (const gram of candidateTrigrams) {
    if (baseTrigrams.has(gram)) intersection++;
  }
  return Number((intersection / candidateTrigrams.size).toFixed(4));
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

  const trigramOverlap = computeSetOverlap(refTrigrams, candTrigrams);
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

/**
 * Audits a multi-variation Content Regen batch against both the reference source
 * and other variations in the same batch to prevent repetitive template spam.
 */
export function evaluateBatchOriginality(
  referenceText: string,
  candidates: Array<{ angle: string; scriptText: string }>,
  thresholds: { maxReferenceOverlap?: number; maxPeerOverlap?: number } = {},
): BatchCandidateReport[] {
  const maxRef = thresholds.maxReferenceOverlap ?? 0.25;
  const maxPeer = thresholds.maxPeerOverlap ?? 0.3;

  const refTrigrams = buildTrigrams(normalizeWords(referenceText));
  const candTrigList = candidates.map((c) => buildTrigrams(normalizeWords(c.scriptText)));

  return candidates.map((cand, idx) => {
    const ownTrigrams = candTrigList[idx] ?? new Set<string>();
    const referenceOverlap = refTrigrams.size > 0 ? computeSetOverlap(refTrigrams, ownTrigrams) : 0;

    let maxPeerOverlap = 0;
    for (let j = 0; j < candTrigList.length; j++) {
      if (j === idx) continue;
      const peerTrigrams = candTrigList[j];
      if (!peerTrigrams) continue;
      const overlap = computeSetOverlap(peerTrigrams, ownTrigrams);
      if (overlap > maxPeerOverlap) maxPeerOverlap = overlap;
    }

    const reasons: string[] = [];
    if (referenceOverlap > maxRef) {
      reasons.push(
        `Kemiripan terhadap referensi ${(referenceOverlap * 100).toFixed(1)}% melebihi batas ${(maxRef * 100).toFixed(1)}%`,
      );
    }
    if (maxPeerOverlap > maxPeer) {
      reasons.push(
        `Kemiripan antar variasi ${(maxPeerOverlap * 100).toFixed(1)}% melebihi batas ${(maxPeer * 100).toFixed(1)}%`,
      );
    }
    if (normalizeWords(cand.scriptText).length < 15) {
      reasons.push('Skrip terlalu pendek (< 15 kata) untuk Shorts bernilai informasi penuh.');
    }

    const worstOverlap = Math.max(referenceOverlap, maxPeerOverlap);
    const originalityScore = Number(Math.max(0, Math.min(1, 1 - worstOverlap)).toFixed(4));

    return {
      index: idx,
      angle: cand.angle,
      referenceOverlap,
      maxPeerOverlap,
      originalityScore,
      verdict: reasons.length === 0 ? 'PASS' : 'REVIEW_REQUIRED',
      reasons,
    };
  });
}
