import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { font, radius, spacing } from '@/theme/tokens';

// ---------- Tekst ----------

type Variant = 'display' | 'title' | 'large' | 'body' | 'small' | 'label';

export function AppText({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const { colors } = useTheme();
  const v = textVariants[variant];
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={2}
      accessibilityRole={variant === 'display' || variant === 'title' ? 'header' : rest.accessibilityRole}
      style={[v, { color: color ?? (muted ? colors.textMuted : colors.text) }, style]}
    />
  );
}

const textVariants = StyleSheet.create({
  display: { fontSize: font.display, lineHeight: font.display * 1.2, fontWeight: '700' },
  title: { fontSize: font.title, lineHeight: font.title * 1.25, fontWeight: '700' },
  large: { fontSize: font.large, lineHeight: font.large * 1.4, fontWeight: '600' },
  body: { fontSize: font.body, lineHeight: font.body * 1.45 },
  small: { fontSize: font.small, lineHeight: font.small * 1.4 },
  label: { fontSize: font.small, lineHeight: font.small * 1.4, fontWeight: '600', letterSpacing: 0.3 },
});

// ---------- Scherm ----------

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  const inner: ViewStyle = { padding: padded ? spacing.lg : 0, gap: spacing.md, flexGrow: 1 };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[inner, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Loading({ label = 'Even laden…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
      accessibilityLabel={label}
    >
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

// ---------- Kaart ----------

export function Card({ children, tone = 'surface', style }: { children: ReactNode; tone?: 'surface' | 'alt'; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'alt' ? colors.surfaceAlt : colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ---------- Knop ----------

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const palette: Record<ButtonKind, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  };
  const p = palette[kind];
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      style={({ pressed }) => ({
        minHeight: 50,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        backgroundColor: p.bg,
        borderColor: p.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <AppText variant="large" color={p.fg} style={{ textAlign: 'center', fontSize: font.body }}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

// ---------- Invoer ----------

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" muted>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        maxFontSizeMultiplier={2}
        {...input}
        style={[
          {
            minHeight: 50,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: font.body,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
          input.multiline ? { minHeight: 120, textAlignVertical: 'top', paddingTop: spacing.md } : null,
          input.style,
        ]}
      />
      {error ? <ErrorText message={error} /> : null}
    </View>
  );
}

export function ErrorText({ message }: { message: string | null | undefined }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <AppText variant="small" color={colors.danger} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {message}
    </AppText>
  );
}

// ---------- Kleine elementen ----------

export function Pill({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'secondary' }) {
  const { colors } = useTheme();
  const bg = tone === 'accent' ? colors.accent : colors.secondary;
  const fg = tone === 'accent' ? '#2B2320' : colors.onSecondary;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

export function Row({ children, gap = spacing.sm, wrap }: { children: ReactNode; gap?: number; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }}>{children}</View>;
}

export const DEPTH_LABEL: Record<number, string> = { 1: 'Luchtig', 2: 'Persoonlijk', 3: 'Diep' };
