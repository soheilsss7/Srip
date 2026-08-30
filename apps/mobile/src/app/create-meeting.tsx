import React,{useState}from'react';
import{SafeAreaView,Text,TextInput,Pressable,ScrollView}from'react-native';
import{useRouter}from'expo-router';
import{apiPostOffline}from'../services/api-client';
import{useSession}from'../state/session';
import{EntityPicker}from'../features/entity-picker';
import{styles}from'../lib/ui';

function localDateTime(offsetMs=0){return new Date(Date.now()+offsetMs).toISOString().slice(0,16)}
export default function CreateMeeting(){
 const{token,can}=useSession();const canCreate=can('meeting.write');const router=useRouter();
 const[title,setTitle]=useState('');const[start,setStart]=useState(localDateTime(3600000));const[end,setEnd]=useState('');const[objective,setObjective]=useState('');const[organizationId,setOrganizationId]=useState('');const[organizationLabel,setOrganizationLabel]=useState('');const[relationshipId,setRelationshipId]=useState('');const[relationshipLabel,setRelationshipLabel]=useState('');const[error,setError]=useState('');const[saving,setSaving]=useState(false);
 async function save(){
  if(!canCreate){setError('You do not have permission to create meetings.');return}
  if(title.trim().length<1){setError('Meeting title is required.');return}
  const startDate=new Date(start);const endDate=end.trim()?new Date(end):null;
  if(Number.isNaN(startDate.getTime())){setError('Start date is invalid.');return}
  if(endDate&&Number.isNaN(endDate.getTime())){setError('End date is invalid.');return}
  if(endDate&&endDate<=startDate){setError('End date must be after the start date.');return}
  if(!token){setError('Your session has expired. Please sign in again.');return}
  setSaving(true);setError('');
  try{await apiPostOffline('/meetings',{title:title.trim(),startAt:startDate.toISOString(),endAt:endDate?.toISOString(),objective:objective.trim()||undefined,organizationId:organizationId||undefined,relationshipId:relationshipId||undefined},token);router.back()}
  catch(x){setError((x as Error).message);setSaving(false)}
 }
 if(!canCreate)return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>New Meeting</Text><Text style={styles.error}>You do not have permission to create meetings in the current workspace.</Text></ScrollView></SafeAreaView>;
 return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>New Meeting</Text><TextInput style={styles.input} placeholder="Title (required)" value={title} onChangeText={setTitle} editable={!saving}/><TextInput style={styles.input} placeholder="Start (YYYY-MM-DDTHH:mm)" value={start} onChangeText={setStart} editable={!saving}/><TextInput style={styles.input} placeholder="End (optional)" value={end} onChangeText={setEnd} editable={!saving}/><TextInput style={styles.input} placeholder="Objective" value={objective} onChangeText={setObjective} multiline editable={!saving}/><EntityPicker label="Organization (optional)" endpoint="/organizations" value={organizationId} selectedLabel={organizationLabel} onChange={(id,label)=>{setOrganizationId(id);setOrganizationLabel(label??'')}} disabled={saving}/><EntityPicker label="Relationship (optional)" endpoint="/relationships" value={relationshipId} selectedLabel={relationshipLabel} onChange={(id,label)=>{setRelationshipId(id);setRelationshipLabel(label??'')}} disabled={saving}/>{error?<Text style={styles.error}>{error}</Text>:null}<Pressable style={styles.button} disabled={saving} onPress={save}><Text style={styles.buttonText}>{saving?'Saving…':'Save'}</Text></Pressable></ScrollView></SafeAreaView>
}
