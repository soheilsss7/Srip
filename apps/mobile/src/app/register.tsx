import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { apiPost } from '../services/api-client';
import { styles, colors } from '../lib/ui';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  async function submit() {
    if (!email.trim() || !password) { setError('ایمیل و رمز عبور لازم است.'); return; }
    setBusy(true); setError('');
    try { await apiPost('/auth/register', { email: email.trim(), password, name: name.trim() || undefined }, ''); setOk(true); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>SRIP</Text>
        <Text style={styles.subtitle}>ایجاد حساب</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {ok ? <Text style={{ color: colors.success }}>ثبت‌نام انجام شد. لطفاً ایمیل خود را برای تایید بررسی کنید.</Text> : (
          <>
            <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} />
            <TextInput style={styles.input} placeholder="Name (اختیاری)" value={name} onChangeText={setName} />
            <Pressable style={styles.button} disabled={busy} onPress={submit}><Text style={styles.buttonText}>{busy ? 'ثبت‌نام…' : 'ثبت‌نام'}</Text></Pressable>
          </>
        )}
        <Link href="/login" asChild><Pressable><Text style={{ color: colors.accent, fontWeight: '700', marginTop: 12 }}>بازگشت به ورود</Text></Pressable></Link>
      </View>
    </SafeAreaView>
  );
}
