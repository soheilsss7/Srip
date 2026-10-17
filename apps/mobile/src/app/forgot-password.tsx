import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { apiPost } from '../services/api-client';
import { styles, colors } from '../lib/ui';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  async function request() {
    if (!email.trim()) { setError('ایمیل لازم است.'); return; }
    setBusy(true); setError(''); setMsg('');
    try { await apiPost('/auth/password-reset/request', { email: email.trim() }, ''); setMsg('اگر حساب وجود داشته باشد، درخواست بازیابی ثبت شد. کد را از ایمیل خود بگیرید.'); setStep('confirm'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!code.trim() || !newPassword) { setError('کد و رمز جدید لازم است.'); return; }
    if (newPassword.length < 12) { setError('رمز عبور باید حداقل ۱۲ نویسه باشد.'); return; }
    setBusy(true); setError('');
    try {
      await apiPost('/auth/password-reset/confirm', { token: code.trim(), password: newPassword }, '');
      setMsg('رمز عبور تغییر کرد. اکنون می‌توانید وارد شوید.');
      setTimeout(() => router.replace('/login'), 1200);
    }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>SRIP</Text>
        <Text style={styles.subtitle}>بازیابی رمز عبور</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {msg ? <Text style={{ color: colors.success }}>{msg}</Text> : null}
        <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />
        {step === 'confirm' && (
          <>
            <TextInput style={styles.input} autoCapitalize="none" placeholder="کد بازیابی (token)" value={code} onChangeText={setCode} />
            <TextInput style={styles.input} secureTextEntry placeholder="رمز جدید" value={newPassword} onChangeText={setNewPassword} />
          </>
        )}
        <Pressable style={styles.button} disabled={busy} onPress={step === 'request' ? request : confirm}><Text style={styles.buttonText}>{busy ? '…' : step === 'request' ? 'ارسال درخواست' : 'تایید و تغییر'}</Text></Pressable>
        <Link href="/login" asChild><Pressable><Text style={{ color: colors.accent, fontWeight: '700', marginTop: 12 }}>بازگشت به ورود</Text></Pressable></Link>
      </View>
    </SafeAreaView>
  );
}
