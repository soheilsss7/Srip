import React from 'react';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';
import { Link } from 'expo-router';
import { styles, colors } from '../../lib/ui';

const LINKS: [string, string][] = [
  ['/dashboard', 'Dashboard'],
  ['/organizations', 'Organizations'],
  ['/people', 'People'],
  ['/relationships', 'Relationships'],
  ['/projects', 'Projects'],
  ['/opportunities', 'Opportunities'],
  ['/commitments', 'Commitments'],
  ['/recommendations', 'Recommendations'],
  ['/network', 'Network'],
  ['/documents', 'Documents'],
  ['/intelligence', 'Intelligence'],
  ['/data-quality', 'Data Quality'],
  ['/search', 'Search'],
];

export default function Home() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Workspace</Text>
        <Text style={styles.subtitle}>Everything across SRIP.</Text>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href as any} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.value}>{label}</Text>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Open →</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}