import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useT, useLocale } from '@/i18n';
import { useColors } from '@/hooks/useColors';
import type { Locale } from '@/i18n/types';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
];

export default function SettingsScreen() {
  const t = useT();
  const colors = useColors();
  const { locale, setLocale } = useLocale();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t.mobile.tabSettings}
        </Text>
      </View>

      <View style={styles.body}>
        {/* Language section */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t.mobile.settingsLanguage.toUpperCase()}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.languagePill, { backgroundColor: colors.muted }]}>
            {LOCALES.map(({ value, label }) => {
              const isActive = locale === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setLocale(value)}
                  style={[
                    styles.langBtn,
                    isActive && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.langLabel,
                      { color: isActive ? '#fff' : colors.mutedForeground },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* About section */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t.mobile.settingsAbout.toUpperCase()}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.foreground }]}>
              {t.mobile.settingsAppName}
            </Text>
            <Text style={[styles.aboutValue, { color: colors.mutedForeground }]}>
              {t.mobile.settingsTagline}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.foreground }]}>
              {t.mobile.settingsVersion}
            </Text>
            <Text style={[styles.aboutValue, { color: colors.mutedForeground }]}>
              {Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '700' },
  body: { padding: 16, gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
    padding: 16,
  },
  languagePill: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    alignSelf: 'flex-start',
  },
  langBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
  },
  langLabel: { fontSize: 14, fontWeight: '600' },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  aboutLabel: { fontSize: 15 },
  aboutValue: { fontSize: 14 },
  divider: { height: 1, marginVertical: 8 },
});
