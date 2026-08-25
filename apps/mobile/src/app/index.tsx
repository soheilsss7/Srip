import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

export default function HomeScreen() {
  const items = ['Dashboard', 'Relationships', 'Meetings', 'Actions', 'Notifications', 'AI Assistant'];
  return <SafeAreaView><ScrollView contentContainerStyle={{padding:24,gap:16}}><Text style={{fontSize:28,fontWeight:'700'}}>SRIP</Text><Text style={{fontSize:16}}>Strategic Relationship Intelligence</Text>{items.map(item => <View key={item} style={{padding:18,borderWidth:1,borderColor:'#ddd',borderRadius:12}}><Text style={{fontSize:18,fontWeight:'600'}}>{item}</Text></View>)}</ScrollView></SafeAreaView>;
}
