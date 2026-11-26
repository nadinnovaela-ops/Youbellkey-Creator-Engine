import type { CharacterProfile } from '@youbellkey/video-schema';

function escapeAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates a stylized cel-shaded SVG host/mascot portrait overlay that
 * stays visually consistent across all scenes in a video and supports
 * deterministic JS lip-sync & blinking in HyperFrames.
 */
export function buildConsistentCharacterDockHtml(character?: CharacterProfile): string {
  if (!character || !character.enabled || character.presetId === 'none') {
    return '';
  }

  const posClass =
    character.position === 'top-left'
      ? 'char-pos-top-left'
      : character.position === 'bottom-left'
        ? 'char-pos-bottom-left'
        : 'char-pos-top-right';

  const primary = escapeAttr(character.primaryColor);
  const accent = escapeAttr(character.accentColor);
  const hair = escapeAttr(character.hairColor);
  const skin = escapeAttr(character.skinTone);
  const name = escapeAttr(character.name.split('(')[0]?.trim() || 'Host');
  const isAria = character.presetId === 'aria-tech';
  const isNova = character.presetId === 'nova-analyst';

  const hairMarkup = isAria
    ? `<path d="M52 88 C48 45, 72 28, 100 28 C128 28, 152 45, 148 88 L152 126 C144 128, 136 122, 134 114 L132 76 C122 60, 78 60, 68 76 L66 114 C64 122, 56 128, 48 126 Z" fill="${hair}" stroke="#0F172A" stroke-width="4" stroke-linejoin="round"/>`
    : `<path d="M56 76 C56 38, 78 26, 102 26 C128 26, 145 42, 144 74 C135 58, 118 52, 98 54 C80 56, 66 64, 56 76 Z" fill="${hair}" stroke="#0F172A" stroke-width="4" stroke-linejoin="round"/>`;

  const accessoryMarkup = isNova
    ? `<g stroke="#0F172A" stroke-width="3.5" fill="none">
         <rect x="70" y="75" width="24" height="16" rx="5" fill="rgba(255,255,255,0.2)"/>
         <rect x="106" y="75" width="24" height="16" rx="5" fill="rgba(255,255,255,0.2)"/>
         <line x1="94" y1="83" x2="106" y2="83"/>
       </g>`
    : isAria
      ? `<g>
           <path d="M52 80 C48 44, 152 44, 148 80" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
           <rect x="44" y="74" width="12" height="24" rx="5" fill="${accent}" stroke="#0F172A" stroke-width="3"/>
           <rect x="144" y="74" width="12" height="24" rx="5" fill="${accent}" stroke="#0F172A" stroke-width="3"/>
         </g>`
      : '';

  return `
    <div id="character-dock" class="char-dock ${posClass}">
      <div id="character-frame" class="char-frame" style="border-color: ${accent};">
        <svg viewBox="0 0 200 200" width="164" height="164" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="ybCharBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1E293B"/>
              <stop offset="100%" stop-color="#0F172A"/>
            </linearGradient>
          </defs>
          <rect width="200" height="200" rx="28" fill="url(#ybCharBg)"/>
          <circle cx="100" cy="96" r="76" fill="${primary}" opacity="0.18"/>
          <g id="char-head-group">
            <!-- Shoulders & Jacket -->
            <path d="M36 200 C36 154, 62 138, 100 138 C138 138, 164 154, 164 200 Z" fill="${primary}" stroke="#0F172A" stroke-width="4"/>
            <path d="M84 138 L100 164 L116 138 Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
            <rect x="92" y="122" width="16" height="24" rx="6" fill="${skin}" stroke="#0F172A" stroke-width="3.5"/>
            <!-- Ears -->
            <circle cx="56" cy="88" r="10" fill="${skin}" stroke="#0F172A" stroke-width="3.5"/>
            <circle cx="144" cy="88" r="10" fill="${skin}" stroke="#0F172A" stroke-width="3.5"/>
            <!-- Face -->
            <rect x="58" y="42" width="84" height="90" rx="40" fill="${skin}" stroke="#0F172A" stroke-width="4"/>
            <!-- Cheek blush -->
            <ellipse cx="74" cy="98" rx="7" ry="4" fill="#FB7185" opacity="0.4"/>
            <ellipse cx="126" cy="98" rx="7" ry="4" fill="#FB7185" opacity="0.4"/>
            <!-- Eyes (controlled by JS for deterministic blinking) -->
            <g id="char-eyes">
              <ellipse id="char-eye-l" cx="82" cy="83" rx="5.5" ry="7" fill="#0F172A"/>
              <ellipse id="char-eye-r" cx="118" cy="83" rx="5.5" ry="7" fill="#0F172A"/>
              <circle cx="80" cy="80" r="2" fill="#FFFFFF"/>
              <circle cx="116" cy="80" r="2" fill="#FFFFFF"/>
            </g>
            <!-- Eyebrows -->
            <path d="M73 69 Q82 65 90 69" fill="none" stroke="${hair}" stroke-width="4" stroke-linecap="round"/>
            <path d="M110 69 Q118 65 127 69" fill="none" stroke="${hair}" stroke-width="4" stroke-linecap="round"/>
            <!-- Animated Talking Mouth -->
            <g id="char-mouth-group" transform="translate(100 112)">
              <rect id="char-mouth" x="-11" y="-3" width="22" height="6" rx="4" fill="#991B1B" stroke="#0F172A" stroke-width="3"/>
              <rect id="char-tongue" x="-6" y="0" width="12" height="3" rx="1.5" fill="#F43F5E" opacity="0"/>
            </g>
            ${hairMarkup}
            ${accessoryMarkup}
          </g>
        </svg>
        <div class="char-nameplate" style="border-left-color: ${accent};">
          <span class="char-live-dot" style="background: ${accent};"></span>
          <span>${name}</span>
        </div>
      </div>
    </div>
  `;
}
