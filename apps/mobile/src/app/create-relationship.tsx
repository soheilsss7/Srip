import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { apiPostOffline } from '../services/api-client';
import { useSession } from '../state/session';
import { EntityPicker } from '../features/entity-picker';
import { styles } from '../lib/ui';

export default function CreateRelationship(){
  const { token, can } = useSession();
  const canCreate = can('relationship.write');
  const router = useRouter();
  const [sourceOrganizationId,setSourceOrganizationId]=useState('');
  const [sourceLabel,setSourceLabel]=useState('');
  const [targetOrganizationId,setTargetOrganizationId]=useState('');
  const [targetLabel,setTargetLabel]=useState('');
  const [relationshipType,setRelationshipType]=useState('PARTNER');
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);

  async function save(){
    if(!canCreate){setError('You do not have permission to create relationships.');return}
    if(!sourceOrganizationId||!targetOrganizationId){setError('Both organizations are required.');return}
    if(sourceOrganizationId===targetOrganizationId){setError('Source and target organizations must be different.');return}
    if(!relationshipType.trim()){setError('Relationship type is required.');return}
    if(!token){setError('Your session has expired. Please sign in again.');return}
    setSaving(true);setError('');
    try{await apiPostOffline('/relationships',{sourceOrganizationId,targetOrganizationId,relationshipType:relationshipType.trim()},token);router.back()}
    catch(x){setError((x as Error).message);setSaving(false)}
  }
  if(!canCreate)return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>New Relationship</Text><Text style={styles.error}>You do not have permission to create relationships in the current workspace.</Text></ScrollView></SafeAreaView>;
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>New Relationship</Text><EntityPicker label="Source organization" endpoint="/organizations" value={sourceOrganizationId} selectedLabel={sourceLabel} onChange={(id,label)=>{setSourceOrganizationId(id);setSourceLabel(label??'')}} required disabled={saving}/><EntityPicker label="Target organization" endpoint="/organizations" value={targetOrganizationId} selectedLabel={targetLabel} onChange={(id,label)=>{setTargetOrganizationId(id);setTargetLabel(label??'')}} required disabled={saving}/><TextInput style={styles.input} placeholder="Relationship type" value={relationshipType} onChangeText={setRelationshipType} editable={!saving}/>{error?<Text style={styles.error}>{error}</Text>:null}<Pressable style={styles.button} disabled={saving} onPress={save}><Text style={styles.buttonText}>{saving?'Saving…':'Save'}</Text></Pressable></ScrollView></SafeAreaView>
}
