/**
 * Shared UI primitives for Censoris.
 *
 * Design rules baked in here:
 * - Touch targets are at least 48dp (theme.touchTargetMin).
 * - Thin rules and small radii; no heavy cards, no gradients.
 * - Everything reads colours from the active theme (light/dark).
 * - accessibilityLabel/ accessibilityRole on every interactive control.
 */
import { Pressable, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useSettingsStore } from '../store/settings-store';
import { resolveTypeStyle } from './fonts';
import { useTheme } from './theme-context';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>{children}</View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Button({ label, onPress, variant = 'primary', disabled, accessibilityLabel }: ButtonProps) {
  const theme = useTheme();
  const lang = useLang();
  const colors = {
    primary: { bg: theme.colors.primary, fg: theme.colors.onPrimary, border: theme.colors.primary },
    secondary: { bg: theme.colors.surface, fg: theme.colors.text, border: theme.colors.border },
    ghost: { bg: 'transparent', fg: theme.colors.primary, border: 'transparent' },
    danger: { bg: 'transparent', fg: theme.colors.danger, border: theme.colors.danger },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled ?? false }}
      style={({ pressed }) => ({
        minHeight: theme.touchTargetMin,
        paddingHorizontal: theme.spacing(5),
        paddingVertical: theme.spacing(3),
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          ...resolveTypeStyle('bodyMedium', lang),
          color: colors.fg,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Heading({ text, level = 2 }: { text: string; level?: 1 | 2 }) {
  const theme = useTheme();
  const lang = useLang();
  const style = resolveTypeStyle(level === 1 ? 'h1' : 'h2', lang);
  return (
    <Text
      accessibilityRole="header"
      style={{ ...style, color: theme.colors.text, marginBottom: theme.spacing(2) }}
    >
      {text}
    </Text>
  );
}

export function Body({ text, muted, style }: { text: string; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  const lang = useLang();
  return (
    <Text style={[resolveTypeStyle('body', lang), { color: muted ? theme.colors.textMuted : theme.colors.text, lineHeight: 24 }, style]}>
      {text}
    </Text>
  );
}

/** Thin horizontal rule — the ledger look, used instead of heavy card borders. */
export function Rule() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing(3) }} />;
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  secureTextEntry?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
}

export function TextField({ label, value, onChangeText, keyboardType = 'default', secureTextEntry, placeholder, accessibilityLabel }: FieldProps) {
  const theme = useTheme();
  const lang = useLang();
  return (
    <View style={{ marginBottom: theme.spacing(4) }}>
      <Text
        accessibilityLabel={`${label}`}
        style={[resolveTypeStyle('caption', lang), { color: theme.colors.textMuted, marginBottom: theme.spacing(1) }]}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? label}
        style={{
          ...resolveTypeStyle('body', lang),
          minHeight: theme.touchTargetMin,
          color: theme.colors.text,
          backgroundColor: theme.colors.inputBackground,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing(3),
        }}
      />
    </View>
  );
}

/** Active UI language (for per-script font selection). */
export function useLang(): string {
  return useSettingsStore((s) => s.language);
}
