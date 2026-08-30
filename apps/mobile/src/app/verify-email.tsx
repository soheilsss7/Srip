import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiPost } from '../services/api-client';
import { colors, styles } from '../lib/ui';

export default function VerifyEmail(){
  const params=useLocalSearchParams<{token?:string}>();
  const router=useRouter();
  const [token,setToken]=useState(String(params.token??''));
  const [busy,setBusy]=useState(false);
  const [verified,setVerified]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{const value=String(params.token??'');if(value){setToken(value);void verify(value)}},[params.token]);
  async function verify(value=token){
    if(!value.trim()){setError('لینک یا کد تأیید ایمیل را وارد کنید.');return}
    setBusy(true);setError('');
    try{await apiPost('/auth/email/verify',{token:value.trim()},'');setVerified(true)}
    catch(e){setError(e instanceof Error?e.message:'Verification failed')}
    finally{setBusy(false)}
  }
  return <SafeAreaView style={styles.screen}><View style={styles.content}><Text style={styles.title}>تأیید ایمیل</Text><Text style={styles.subtitle}>برای فعال‌شدن ورود، لینک تأیید ایمیل را باز کنید یا کد آن را وارد کنید.</Text>{error?<Text style={styles.error}>{error}</Text>:null}{busy?<ActivityIndicator color={colors.accent}/>:null}{verified?<View style={styles.card}><Text style={{color:colors.success,fontWeight:'700'}}>ایمیل شما با موفقیت تأیید شد.</Text><Pressable style={styles.button} onPress={()=>router.replace('/login')}><Text style={styles.buttonText}>ورود به حساب</Text></Pressable></View>:<><TextInput style={styles.input} value={token} onChangeText={setToken} placeholder="کد تأیید ایمیل" autoCapitalize="none" editable={!busy}/><Pressable style={styles.button} disabled={busy} onPress={()=>void verify()}><Text style={styles.buttonText}>{busy?'در حال تأیید…':'تأیید ایمیل'}</Text></Pressable></>}<Pressable onPress={()=>router.replace('/login')}><Text style={{color:colors.accent,fontWeight:'700'}}>بازگشت به ورود</Text></Pressable></View></SafeAreaView>
}
