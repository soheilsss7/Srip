import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Text, TextInput } from 'react-native';
import { apiGet, apiPost } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

export default function MFA() {
  const { token } = useSession();
  const [mode, setMode] = useState<'verify' | 'enroll'>('verify');
  const [code, setCode] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [required, setRequired] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try { const r = await apiGet<{ required: boolean }>('/auth/mfa/required', token); setRequired(!!r.required); }
    catch (e) { setError((e as Error).message); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function verify() {
    if (!token) return;
    setBusy(true); setMsg(''); setError(null);
    try { const r = await apiPost<{ verified: boolean }>('/auth/mfa/verify', { code }, token); setMsg(r?.verified ? 'Verified.' : 'Code not valid.'); setCode(''); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function enroll() {
    if (!token) return;
    setBusy(true); setMsg(''); setError(null);
    try { const r = await apiPost<any>('/auth/mfa/enroll', { label: 'Mobile Authenticator' }, token); setDeviceId(r?.deviceId ?? ''); setSecret(r?.secret ?? ''); setOtpauth(r?.otpauthUrl ?? ''); setMsg('Scan the OTP URL in your authenticator app, then enter the 6-digit code.'); setMode('enroll'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function verifyEnrollment() {
    if (!token) return;
    setBusy(true); setMsg(''); setError(null);
    try { const r = await apiPost<any>('/auth/mfa/verify-enrollment', { deviceId, code }, token); if (r?.verified) { setRecoveryCodes(r?.recoveryCodes ?? []); setMsg('Enrollment verified.'); setCode(''); } }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>MFA</Text>
        {required === null && !error && <ActivityIndicator />}
        {required === false && <Text style={styles.subtitle}>Two-factor authentication is not currently required for this account.</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {required && mode === 'verify' && (
          <>
            <Text style={styles.subtitle}>Enter your 6-digit TOTP code or a recovery code.</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={code} onChangeText={setCode} placeholder="123456" />
            <Pressable style={styles.button} disabled={busy} onPress={verify}><Text style={styles.buttonText}>{busy ? 'Verifying…' : 'Verify'}</Text></Pressable>
          </>
        )}
        {mode === 'enroll' && (
          <>
            {otpauth ? <TextInput style={styles.input} value={otpauth} editable={false} selectTextOnFocus /> : null}
            {secret ? <Text style={styles.subtitle}>Manual secret: {secret}</Text> : null}
            <TextInput style={styles.input} keyboardType="number-pad" value={code} onChangeText={setCode} placeholder="OTP code" />
            <Pressable style={styles.button} disabled={busy} onPress={verifyEnrollment}><Text style={styles.buttonText}>{busy ? 'Confirming…' : 'Confirm enrollment'}</Text></Pressable>
          </>
        )}
        {!recoveryCodes.length && required === false && <Pressable style={styles.button} disabled={busy} onPress={enroll}><Text style={styles.buttonText}>{busy ? 'Enrolling…' : 'Enroll MFA'}</Text></Pressable>}
        {msg ? <Text style={{ color: colors.success }}>{msg}</Text> : null}
        {recoveryCodes.length > 0 && (
          <Text style={styles.card}>
            <Text style={styles.label}>Recovery codes (store securely)</Text>{'\n'}
            {recoveryCodes.join('  ')}
          </Text>
        )}
        {recoveryCodes.length > 0 && <Pressable style={styles.button} onPress={() => Alert.alert('Recovery codes', recoveryCodes.join('\n'))}><Text style={styles.buttonText}>Show recovery codes</Text></Pressable>}
      </ScrollView>
    </SafeAreaView>
  );
}