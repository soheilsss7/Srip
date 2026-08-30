import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { apiPost } from '../services/api-client';
import { styles, colors } from '../lib/ui';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const router = useRouter();
  async function submit() {
    if (!email.trim() || !password || name.trim().length < 2) { setError('نام، ایمیل و رمز عبور لازم است.'); return; }
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) { setError('رمز عبور باید حداقل ۱۲ کاراکتر و شامل حروف بزرگ، کوچک و عدد باشد.'); return; }
    setBusy(true); setError('');
    try { const result:any=await apiPost('/auth/register', { email: email.trim(), password, name: name.trim() }, ''); setVerificationToken(result?.developmentVerificationToken??''); setOk(true); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>SRIP</Text>
        <Text style={styles.subtitle}>ایجاد حساب</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {ok ? <View style={styles.card}><Text style={{ color: colors.success }}>ثبت‌نام انجام شد.</Text>{verificationToken?<><Text style={styles.subtitle}>در این محیط، لینک تأیید آماده است:</Text><Pressable style={styles.button} onPress={()=>router.push({pathname:'/verify-email',params:{token:verificationToken}})}><Text style={styles.buttonText}>تأیید ایمیل</Text></Pressable></>:<Text style={styles.subtitle}>لطفاً ایمیل خود را برای تأیید بررسی کنید.</Text>}</View> : (
          <>
            <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} />
            <TextInput style={styles.input} placeholder="Name (required)" value={name} onChangeText={setName} />
            <Pressable style={styles.button} disabled={busy} onPress={submit}><Text style={styles.buttonText}>{busy ? 'ثبت‌نام…' : 'ثبت‌نام'}</Text></Pressable>
          </>
        )}
        <Link href="/login" asChild><Pressable><Text style={{ color: colors.accent, fontWeight: '700', marginTop: 12 }}>بازگشت به ورود</Text></Pressable></Link>
      </View>
    </SafeAreaView>
  );
}
