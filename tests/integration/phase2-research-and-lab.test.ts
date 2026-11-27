import { describe, expect, it } from 'vitest';
import {
  extractJsonFromText,
  generateContentVariations,
  normalizeToValidYBVideoDocument,
} from '@youbellkey/ai-gateway';
import {
  CreateResearchSourceRequestSchema,
  GenerateContentLabRequestSchema,
  UpdateProjectDocumentRequestSchema,
} from '@youbellkey/job-contracts';
import { evaluateBatchOriginality } from '@youbellkey/originality-engine';
import { YBVideoDocumentSchema } from '@youbellkey/video-schema';
import {
  extractYoutubeChannelIdFromInput,
  extractYoutubeVideoId,
  parseVttTranscript,
  parseYoutubeRssXml,
  scoreResearchEntries,
} from '../../workers/research-worker/src/core.js';

describe('Phase 2 Viral Research & AI Content Lab', () => {
  it('extracts YouTube video IDs and channel IDs across URL formats', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeVideoId('https://www.youtube.com/shorts/AbCdEfGhIjK')).toBe('AbCdEfGhIjK');
    expect(extractYoutubeVideoId('https://example.com/not-youtube')).toBeNull();

    expect(extractYoutubeChannelIdFromInput('UC_x5XG1OV2P6uZZ5FSM9Ttw')).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
    expect(
      extractYoutubeChannelIdFromInput('https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/videos'),
    ).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
    expect(
      extractYoutubeChannelIdFromInput('https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw'),
    ).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
  });

  it('parses YouTube Atom RSS XML and computes outlier and viral scores', () => {
    const now = Date.parse('2026-11-26T12:00:00.000Z');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
        <entry>
          <yt:videoId>vidNormal01</yt:videoId>
          <title>Daily AI Recap &amp; Tips</title>
          <link rel="alternate" href="https://www.youtube.com/watch?v=vidNormal01"/>
          <author><name>Creator Lab</name></author>
          <published>2026-11-20T12:00:00.000Z</published>
          <media:group>
            <media:description>Simple recap clip</media:description>
            <media:community><media:statistics views="12000"/></media:community>
          </media:group>
        </entry>
        <entry>
          <yt:videoId>vidOutlier2</yt:videoId>
          <title>Sains Cahaya Biru di Atmosfer</title>
          <link rel="alternate" href="https://www.youtube.com/shorts/vidOutlier2"/>
          <author><name>Creator Lab</name></author>
          <published>2026-11-26T00:00:00.000Z</published>
          <media:group>
            <media:description>Eksperimen sains cepat tentang cahaya biru</media:description>
            <media:community><media:statistics views="180000"/></media:community>
          </media:group>
        </entry>
      </feed>`;

    const entries = parseYoutubeRssXml(xml);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.title).toBe('Daily AI Recap & Tips');

    const apiStats = new Map([
      [
        'vidOutlier2',
        {
          videoId: 'vidOutlier2',
          viewCount: 180000,
          likeCount: 14000,
          commentCount: 800,
          durationSeconds: 42,
          tags: ['sains'],
        },
      ],
    ]);

    const scored = scoreResearchEntries(entries, { niche: 'sains cahaya', apiStats, nowMs: now });
    expect(scored[0]?.externalVideoId).toBe('vidOutlier2');
    expect(scored[0]?.outlierScore).toBeGreaterThan(1);
    expect(scored[0]?.viralScore).toBeGreaterThan(scored[1]?.viralScore ?? 0);
    expect(scored[0]?.metadata.isLikelyShort).toBe(true);
  });

  it('cleans WebVTT subtitle tracks into deduplicated plain transcript text', () => {
    const vtt = `WEBVTT
Kind: captions
Language: id

00:00:00.000 --> 00:00:02.000
<c>Pernah</c> lihat langit berubah warna?

00:00:02.000 --> 00:00:04.000
<c>Pernah</c> lihat langit berubah warna?

00:00:04.000 --> 00:00:06.500
Ini efek hamburan Rayleigh di atmosfer bumi.`;

    expect(parseVttTranscript(vtt)).toBe(
      'Pernah lihat langit berubah warna? Ini efek hamburan Rayleigh di atmosfer bumi.',
    );
  });

  it('generates 3-5 multilingual ID/EN variations with valid YB Video Document v1.0 and originality audit', async () => {
    const idResult = await generateContentVariations(
      {
        topicOrTitle: 'Efisiensi Baterai Solid-State untuk Mobil Listrik',
        referenceTranscript:
          'Video referensi lama ini membahas sejarah panjang kendaraan listrik dan harga nikel global tahun lalu.',
        locale: 'id-ID',
        videoTrack: 'MOTION_EXPLAINER',
        variationCount: 4,
      },
      {},
    );

    expect(idResult.variations).toHaveLength(4);
    for (const v of idResult.variations) {
      expect(() => YBVideoDocumentSchema.parse(v.ybVideoDoc)).not.toThrow();
      expect(v.ybVideoDoc.project.locale).toBe('id-ID');
      expect(v.ybVideoDoc.project.width).toBe(1080);
      expect(v.ybVideoDoc.project.height).toBe(1920);
      expect(v.originality.verdict).toBe('PASS');
    }

    const enResult = await generateContentVariations(
      {
        topicOrTitle: 'Why Fiber Optic Cables Transmit Light Around Corners',
        locale: 'en-US',
        videoTrack: 'AI_STORYTELLING',
        variationCount: 5,
      },
      {},
    );

    expect(enResult.variations).toHaveLength(5);
    for (const v of enResult.variations) {
      expect(v.ybVideoDoc.project.locale).toBe('en-US');
      expect(v.ybVideoDoc.scenes.every((s) => s.templateId === 'ai-visual-storytelling')).toBe(true);
    }
  });

  it('flags repetitive peer scripts and excessive reference overlap in batch originality checks', () => {
    const dupScript =
      'mengapa botol kaca berwarna hijau melindungi minuman dari paparan sinar matahari secara efektif';
    const reports = evaluateBatchOriginality(dupScript, [
      { angle: 'Copy', scriptText: dupScript },
      { angle: 'Duplicate A', scriptText: 'langkah pertama ukur performa CPU dan memori sebelum melakukan rendering video di laptop' },
      { angle: 'Duplicate B', scriptText: 'langkah pertama ukur performa CPU dan memori sebelum melakukan rendering video di laptop' },
    ]);

    expect(reports[0]?.verdict).toBe('REVIEW_REQUIRED');
    expect(reports[1]?.verdict).toBe('REVIEW_REQUIRED');
    expect(reports[2]?.verdict).toBe('REVIEW_REQUIRED');
  });

  it('parses fenced LLM JSON and validates Phase 2 API request contracts', () => {
    const extracted = extractJsonFromText('Berikut hasilnya:\n```json\n{"variations":[{"title":"Test"}]}\n```') as {
      variations: Array<{ title: string }>;
    };
    expect(extracted.variations[0]?.title).toBe('Test');

    const normalized = normalizeToValidYBVideoDocument(
      { scenes: [{ durationSeconds: 5, backgroundLayer: { kind: 'typography', headline: 'Tes' }, voiceover: { text: 'Halo dunia' } }] },
      { title: 'Judul Shorts', locale: 'id-ID', videoTrack: 'MOTION_EXPLAINER', scenesText: ['Halo dunia'] },
    );
    expect(normalized.scenes[0]?.templateId).toBe('kinetic-typography');

    expect(() => CreateResearchSourceRequestSchema.parse({ channelInput: '@GadgetIn', niche: 'Teknologi' })).not.toThrow();
    expect(() => GenerateContentLabRequestSchema.parse({ locale: 'id-ID', variationCount: 3 })).toThrow();
    expect(() => GenerateContentLabRequestSchema.parse({ topic: 'Topik', variationCount: 0 })).toThrow();
    expect(() =>
      UpdateProjectDocumentRequestSchema.parse({ ybVideoDoc: normalized as unknown as Record<string, unknown> }),
    ).not.toThrow();
  });
});

/* ## Riwayat Pengerjakan (Work History)
- [27-11-2026 17:30:00 WIB] Model: Kilo | Sesi: fix-variationcount-min-validation | Aksi: Update test expectation GenerateContentLabRequestSchema variationCount: 2 → 0 karena min diubah dari 3 menjadi 1, sehingga variationCount: 2 sudah valid dan tidak boleh throw | File: tests/integration/phase2-research-and-lab.test.ts | Status: selesai */
