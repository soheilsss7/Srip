import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { styles, colors } from '../lib/ui';

export default function ConflictResolution() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Conflict Resolution</Text>
        <Text style={styles.subtitle}>This screen is a design placeholder: the SRIP API does not expose a conflict-resolution endpoint.</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Why no conflicts are surfaced</Text>
          <Text style={styles.value}>All mutations are sent to the server as the source of truth. When connectivity is unavailable, writes are captured in the local optimistic/offline queue and delivered in order on reconnect, so the client never silently overwrites server data. Validation failures that can never succeed (4xx) are surfaced to the user instead of being replayed.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Related tools</Text>
          <Link href="/offline-queue" style={styles.buttonText}>Offline queue →</Link>
          <Link href="/retry" style={styles.buttonText}>Retry →</Link>
          <Link href="/sync" style={styles.buttonText}>Sync →</Link>
          <Text style={{ color: colors.muted }}>There is nothing to resolve while the queue is empty.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}