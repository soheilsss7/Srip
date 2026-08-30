import React from 'react';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';
import { Link } from 'expo-router';
import { styles, colors } from '../../lib/ui';
import { useSession } from '../../state/session';

type HomeLink = { href: string; label: string; permission?: string };
const LINKS: HomeLink[] = [
  { href: '/dashboard', label: 'Dashboard', permission: 'report.read' },
  { href: '/today', label: 'Today', permission: 'action.read' },
  { href: '/organizations', label: 'Organizations', permission: 'org.read' },
  { href: '/people', label: 'People', permission: 'person.read' },
  { href: '/relationships', label: 'Relationships', permission: 'relationship.read' },
  { href: '/projects', label: 'Projects', permission: 'project.read' },
  { href: '/opportunities', label: 'Opportunities', permission: 'opportunity.read' },
  { href: '/commitments', label: 'Commitments', permission: 'commitment.read' },
  { href: '/recommendations', label: 'Recommendations', permission: 'recommendation.read' },
  { href: '/network', label: 'Network', permission: 'network.read' },
  { href: '/documents', label: 'Documents', permission: 'document.read' },
  { href: '/intelligence', label: 'Intelligence', permission: 'network.read' },
  { href: '/data-quality', label: 'Data Quality', permission: 'data.quality.read' },
  { href: '/search', label: 'Search', permission: 'search.read' },
];

export default function Home() {
  const { can } = useSession();
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>Workspace</Text><Text style={styles.subtitle}>Everything across SRIP.</Text>{LINKS.filter(link => !link.permission || can(link.permission)).map(link => <Link key={link.href} href={link.href as any} asChild><Pressable style={styles.card}><Text style={styles.value}>{link.label}</Text><Text style={{ color: colors.accent, fontWeight: '700' }}>Open →</Text></Pressable></Link>)}</ScrollView></SafeAreaView>;
}
