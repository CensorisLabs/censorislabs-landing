/**
 * Font registration for Censoris.
 *
 * - Cinzel: wordmark and headings (classical Roman authority).
 * - Inter: body and numbers (tabular figures for amounts).
 * - Noto Sans (per Indic script): body text when the UI language uses that
 *   script. Android cannot fall back across families like iOS can, so we
 *   pick the body family from the active language (see bodyFamilyForLang).
 *
 * Loaded fonts are registered by App.tsx with useFonts before rendering.
 */
import { Cinzel_400Regular, Cinzel_600SemiBold } from '@expo-google-fonts/cinzel';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { NotoSansDevanagari_400Regular, NotoSansDevanagari_500Medium, NotoSansDevanagari_600SemiBold } from '@expo-google-fonts/noto-sans-devanagari';
import { NotoSansTamil_400Regular, NotoSansTamil_500Medium, NotoSansTamil_600SemiBold } from '@expo-google-fonts/noto-sans-tamil';
import { NotoSansTelugu_400Regular, NotoSansTelugu_500Medium, NotoSansTelugu_600SemiBold } from '@expo-google-fonts/noto-sans-telugu';
import { NotoSansBengali_400Regular, NotoSansBengali_500Medium, NotoSansBengali_600SemiBold } from '@expo-google-fonts/noto-sans-bengali';
import { NotoSansGujarati_400Regular, NotoSansGujarati_500Medium, NotoSansGujarati_600SemiBold } from '@expo-google-fonts/noto-sans-gujarati';
import { NotoSansKannada_400Regular, NotoSansKannada_500Medium, NotoSansKannada_600SemiBold } from '@expo-google-fonts/noto-sans-kannada';

export const fonts = {
  Cinzel_400Regular,
  Cinzel_600SemiBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansTamil_400Regular,
  NotoSansTamil_500Medium,
  NotoSansTamil_600SemiBold,
  NotoSansTelugu_400Regular,
  NotoSansTelugu_500Medium,
  NotoSansTelugu_600SemiBold,
  NotoSansBengali_400Regular,
  NotoSansBengali_500Medium,
  NotoSansBengali_600SemiBold,
  NotoSansGujarati_400Regular,
  NotoSansGujarati_500Medium,
  NotoSansGujarati_600SemiBold,
  NotoSansKannada_400Regular,
  NotoSansKannada_500Medium,
  NotoSansKannada_600SemiBold,
};

export type FontName = keyof typeof fonts;

type Weight = '400Regular' | '500Medium' | '600SemiBold' | '700Bold';
interface TypeStyle {
  face: 'cinzel' | 'body';
  weight: Weight;
  fontSize: number;
  tabular?: boolean;
}

/** Logical type styles used across the app. */
export const typeStyles = {
  wordmark: { face: 'cinzel', weight: '600SemiBold', fontSize: 22 } satisfies TypeStyle,
  h1: { face: 'cinzel', weight: '600SemiBold', fontSize: 24 } satisfies TypeStyle,
  h2: { face: 'cinzel', weight: '600SemiBold', fontSize: 19 } satisfies TypeStyle,
  body: { face: 'body', weight: '400Regular', fontSize: 16 } satisfies TypeStyle,
  bodyMedium: { face: 'body', weight: '500Medium', fontSize: 16 } satisfies TypeStyle,
  bodyBold: { face: 'body', weight: '700Bold', fontSize: 16 } satisfies TypeStyle,
  caption: { face: 'body', weight: '400Regular', fontSize: 13 } satisfies TypeStyle,
  /** Amounts: tabular figures so columns line up. */
  amount: { face: 'body', weight: '500Medium', fontSize: 18, tabular: true } satisfies TypeStyle,
  amountLarge: { face: 'body', weight: '600SemiBold', fontSize: 28, tabular: true } satisfies TypeStyle,
} as const;

/** Language code -> body font family base name. */
const INDIC_FAMILIES: Record<string, string> = {
  hi: 'NotoSansDevanagari', // Hindi, Marathi
  mr: 'NotoSansDevanagari',
  ta: 'NotoSansTamil',
  te: 'NotoSansTelugu',
  bn: 'NotoSansBengali',
  gu: 'NotoSansGujarati',
  kn: 'NotoSansKannada',
};

/**
 * Resolve a logical type style to concrete font family names for a language.
 * Headings always use Cinzel (it has no Indic glyphs; Android will fall back
 * to the system font for Indic characters, which is acceptable for headings).
 * Body text switches wholesale to the language's Noto family because Android
 * cannot use comma-separated font fallback lists.
 */
export function resolveTypeStyle(style: keyof typeof typeStyles, lang: string): { fontFamily: string; fontSize: number; fontVariant?: readonly 'tabular-nums'[] } {
  const s: TypeStyle = typeStyles[style];
  const indic = INDIC_FAMILIES[lang];

  let fontFamily: string;
  if (s.face === 'cinzel') {
    fontFamily = `Cinzel_${s.weight}`;
  } else if (indic) {
    fontFamily = `${indic}_${s.weight}`;
  } else {
    fontFamily = `Inter_${s.weight}`;
  }
  return s.tabular ? { fontFamily, fontSize: s.fontSize, fontVariant: ['tabular-nums'] } : { fontFamily, fontSize: s.fontSize };
}
