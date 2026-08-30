import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { apiGet, ApiClientError } from '../services/api-client';
import { useSession } from '../state/session';
import { colors, styles } from '../lib/ui';

type Entity = {
  id: string;
  label?: string;
  name?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  subject?: string;
  type?: string;
  organization?: { name?: string };
};

type EntityPickerProps = {
  label: string;
  endpoint: string;
  value: string;
  selectedLabel?: string;
  onChange: (id: string, label?: string) => void;
  required?: boolean;
  disabled?: boolean;
};

function rowsOf(value: any): Entity[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function entityLabel(entity: Entity): string {
  return entity.label || entity.name || entity.displayName || entity.title || entity.subject || [entity.firstName, entity.lastName].filter(Boolean).join(' ') || entity.type || 'Unnamed record';
}

function queryKey(endpoint: string): string {
  return endpoint.includes('/organizations') || endpoint.includes('/people') || endpoint.includes('/relationships') ? 'q' : 'search';
}

export function EntityPicker({ label, endpoint, value, selectedLabel, onChange, required = false, disabled = false }: EntityPickerProps) {
  const { token, scopeId } = useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selected = useMemo(() => items.find(item => item.id === value), [items, value]);
  const currentLabel = selected ? entityLabel(selected) : selectedLabel || (value ? 'Selected record' : 'Choose a record');

  useEffect(() => {
    if (!open || !token || disabled) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: '1', pageSize: '100' });
        if (query.trim()) params.set(queryKey(endpoint), query.trim());
        if (scopeId && scopeId !== 'all') params.set('organizationId', scopeId);
        const response = await apiGet<any>(`${endpoint}?${params.toString()}`, token);
        if (!cancelled) setItems(rowsOf(response));
      } catch (reason) {
        if (!cancelled) setError(reason instanceof ApiClientError ? reason.message : reason instanceof Error ? reason.message : 'Unable to load records');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [disabled, endpoint, open, query, scopeId, token]);

  function close() {
    setOpen(false);
    setQuery('');
    setError('');
  }

  return <>
    <View>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <Pressable style={[styles.input, { justifyContent: 'center', minHeight: 48, opacity: disabled ? 0.55 : 1 }]} disabled={disabled} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Choose ${label}`}>
        <Text style={{ color: value ? colors.text : colors.muted }}>{currentLabel}</Text>
      </Pressable>
      {value ? <Pressable disabled={disabled} onPress={() => onChange('', '')}><Text style={{ color: colors.danger, fontWeight: '700', marginTop: 5 }}>Clear selection</Text></Pressable> : null}
    </View>
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.screen, { paddingTop: 24 }]}>
        <View style={styles.content}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}><Text style={styles.title}>{label}</Text><Pressable onPress={close}><Text style={{ color: colors.accent, fontWeight: '700' }}>Close</Text></Pressable></View>
          <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder={`Search ${label.toLowerCase()}…`} autoFocus autoCapitalize="none" />
          {loading ? <ActivityIndicator color={colors.accent} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!loading && !error && items.length === 0 ? <Text style={styles.subtitle}>No matching records in your authorized scope.</Text> : null}
          <FlatList data={items} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable style={[styles.card, { marginBottom: 8 }]} onPress={() => { onChange(item.id, entityLabel(item)); close(); }}><Text style={styles.value}>{entityLabel(item)}</Text>{item.organization?.name ? <Text style={styles.subtitle}>{item.organization.name}</Text> : null}</Pressable>} />
        </View>
      </View>
    </Modal>
  </>;
}
