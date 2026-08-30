import React from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Text } from 'react-native';
import { Link } from 'expo-router';
import { styles } from '../../lib/ui';
import { useSession } from '../../state/session';

type MoreLink = { href: string; label: string; permission?: string };
const LINKS: MoreLink[] = [
  { href: '/today', label: 'Today', permission: 'action.read' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/search', label: 'Search', permission: 'search.read' },
  { href: '/documents', label: 'Documents', permission: 'document.read' },
  { href: '/add-note', label: 'Notes', permission: 'entity.write' },
  { href: '/ai', label: 'AI Assistant', permission: 'ai.query' },
  { href: '/intelligence', label: 'Intelligence', permission: 'network.read' },
  { href: '/recommendations', label: 'Recommendations', permission: 'recommendation.read' },
  { href: '/integrations', label: 'Integrations', permission: 'integration.read' },
  { href: '/network', label: 'Network', permission: 'network.read' },
  { href: '/organizations', label: 'Organizations', permission: 'org.read' },
  { href: '/people', label: 'People', permission: 'person.read' },
  { href: '/commitments', label: 'Commitments', permission: 'commitment.read' },
  { href: '/projects', label: 'Projects', permission: 'project.read' },
  { href: '/opportunities', label: 'Opportunities', permission: 'opportunity.read' },
  { href: '/data-quality', label: 'Data Quality', permission: 'data.quality.read' },
];

export default function More(){
  const { signOut, can, online } = useSession();
  const visibleLinks = LINKS.filter(link => !link.permission || can(link.permission));
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>More</Text><Text style={styles.subtitle}>{online ? 'Connected to SRIP' : 'Offline — changes will sync when connection returns'}</Text>{visibleLinks.map(link => <Link key={link.href} href={link.href as any} asChild><Pressable style={styles.card}><Text style={styles.value}>{link.label}</Text><Text style={styles.buttonText}>Open →</Text></Pressable></Link>)}<Link href="/profile" asChild><Pressable style={styles.card}><Text style={styles.value}>Profile &amp; Sessions</Text><Text style={styles.buttonText}>Open →</Text></Pressable></Link><Link href="/settings" asChild><Pressable style={styles.card}><Text style={styles.value}>Settings</Text><Text style={styles.buttonText}>Open →</Text></Pressable></Link><Pressable style={styles.button} onPress={()=>Alert.alert('Sign out','Sign out of this device?', [{text:'Cancel'},{text:'Sign out',style:'destructive',onPress:signOut}])}><Text style={styles.buttonText}>Sign out</Text></Pressable></ScrollView></SafeAreaView>
}
