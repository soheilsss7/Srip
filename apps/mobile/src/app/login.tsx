import React, { useState } from 'react';
import { Alert, SafeAreaView, Text, TextInput, Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';
export default function Login() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await signIn(email.trim(), password, otp.trim() || undefined);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to sign in';
      if (/MFA|two-factor|OTP/i.test(message) && !otp.trim()) { setMfaRequired(true); setOtp(''); }
      Alert.alert('Sign in failed', message);
    } finally { setBusy(false); }
  };
  return <SafeAreaView style={styles.screen}><View style={styles.content}><Text style={styles.title}>SRIP</Text><Text style={styles.subtitle}>Strategic Relationship Intelligence Platform</Text>
    <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />
    <TextInput style={styles.input} secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} />
    {mfaRequired ? <TextInput style={styles.input} keyboardType="number-pad" placeholder="OTP code (6 digits)" value={otp} onChangeText={setOtp} autoFocus /> : null}
    <Pressable style={styles.button} disabled={busy} onPress={submit}><Text style={styles.buttonText}>{busy ? 'Signing in…' : mfaRequired ? 'Verify code' : 'Sign in'}</Text></Pressable>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 12 }}>
      <Link href="/register" asChild><Pressable><Text style={{ color: colors.accent, fontWeight: '700' }}>ثبت‌نام</Text></Pressable></Link>
      <Link href="/forgot-password" asChild><Pressable><Text style={{ color: colors.accent, fontWeight: '700' }}>فراموشی رمز</Text></Pressable></Link>
    </View>
    <Text style={styles.subtitle}>Authentication uses the existing API and stores the session in device secure storage.</Text>
  </View></SafeAreaView>;
}