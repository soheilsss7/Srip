import React,{useEffect,useState} from 'react';
import {View,Text,Pressable,ScrollView,ActivityIndicator,Alert,Linking,StyleSheet} from 'react-native';
import {apiGet,apiPost,api} from '../services/api-client';
import {useSession} from '../state/session';

type Run={id:string;kind:string;startedAt:string;completedAt?:string|null;status:string;seen:number;created:number;updated:number;matchedPeople:number;matchedOrganizations:number;linkedRelationships:number};

export default function Integrations(){
  const {token}=useSession();
  const [items,setItems]=useState<any[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [provider,setProvider]=useState('GOOGLE'),[kind,setKind]=useState('CALENDAR'),[busy,setBusy]=useState('');
  const [runs,setRuns]=useState<Record<string,Run[]>>({}),[openRuns,setOpenRuns]=useState<Record<string,boolean>>({});

  async function load(){if(!token)return;try{setLoading(true);setItems(await apiGet<any[]>('/integrations',token))}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[token]);
  async function act(label:string,fn:()=>Promise<any>){setBusy(label);setError('');try{await fn();await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
  async function sync(id:string){await act('sync'+id,()=>apiPost('/integrations/'+id+'/sync',{},token))}
  async function connect(){await act('connect',async()=>{const r:any=await apiPost('/integrations/authorize',{provider,kind},token);if(r?.authorizeUrl){Linking.openURL(r.authorizeUrl).catch((e)=>{setError(String(e))})}else{setError('No authorize URL returned')}})}
  async function disconnect(x:any){
    Alert.alert('قطع اتصال',`اتصال ${x.provider} · ${x.kind} قطع شود؟`,[{text:'لغو',style:'cancel'},{text:'قطع',style:'destructive',onPress:()=>act('del'+x.id,()=>api('/integrations/'+x.id,{method:'DELETE'},token))}]);
  }
  async function toggleRuns(x:any){const id=x.id,open=!openRuns[id];setOpenRuns(r=>({...r,[id]:open}));if(!open||runs[id])return;setBusy('runs'+id);setError('');try{const list:any=await apiGet('/integrations/'+id+'/sync-runs',token);setRuns(r=>({...r,[id]:Array.isArray(list)?list:(list?.items??[])}))}catch(e){setError((e as Error).message)}finally{setBusy('')}}

  return <ScrollView contentContainerStyle={s.c}>
    <Text style={s.h}>Integrations</Text>
    <Text style={s.p}>Connected Google/Microsoft calendar and email accounts.</Text>
    {error?<Text style={s.e}>{error}</Text>:null}

    <View style={s.row}>
      <View style={{flex:1}}><Text style={s.t}>Connect</Text><Text style={s.p}>پس از OAuth callback اتصال ثبت می‌شود.</Text></View>
    </View>
    <View style={s.rowg}>
      <Pressable style={[s.btn,provider==='GOOGLE'&&s.btnActive]} onPress={()=>setProvider('GOOGLE')}><Text>Google</Text></Pressable>
      <Pressable style={[s.btn,provider==='MICROSOFT'&&s.btnActive]} onPress={()=>setProvider('MICROSOFT')}><Text>Microsoft</Text></Pressable>
      <Pressable style={[s.btn,kind==='CALENDAR'&&s.btnActive]} onPress={()=>setKind('CALENDAR')}><Text>Calendar</Text></Pressable>
      <Pressable style={[s.btn,kind==='EMAIL'&&s.btnActive]} onPress={()=>setKind('EMAIL')}><Text>Email</Text></Pressable>
      <Pressable style={[s.btn,s.btnPrimary]} onPress={connect} disabled={!!busy}><Text style={{color:'#fff'}}>{busy==='connect'?'…':'Connect'}</Text></Pressable>
    </View>

    {loading?<ActivityIndicator/>:items.map(x=><View style={s.row} key={x.id}>
      <View style={{flex:1}}><Text style={s.t}>{x.provider} · {x.kind}</Text><Text>{x.status}</Text><Text style={s.p}>Last sync: {x.lastSyncAt||'Never'}</Text></View>
      {x.status==='CONNECTED'&&<View style={s.rowg}>
        <Pressable style={s.btn} onPress={()=>sync(x.id)} disabled={!!busy}><Text>Sync</Text></Pressable>
        <Pressable style={s.btn} onPress={()=>toggleRuns(x)} disabled={!!busy}><Text>{openRuns[x.id]?'بستن تاریخچه':'تاریخچه'}</Text></Pressable>
        <Pressable style={[s.btn,s.btnDanger]} onPress={()=>disconnect(x)} disabled={!!busy}><Text>Disconnect</Text></Pressable>
      </View>}
      {openRuns[x.id]&&<View style={{flex:1,marginTop:8}}>
        {!runs[x.id]?<ActivityIndicator/>:runs[x.id].length===0?<Text style={s.p}>هیچ Sync Run ثبت نشده.</Text>:runs[x.id].map(r=><View key={r.id} style={s.run}>
          <Text style={s.t}>{r.kind} · {r.status}</Text>
          <Text style={s.p}>شروع {new Date(r.startedAt).toLocaleString()}{r.completedAt?` · پایان ${new Date(r.completedAt).toLocaleString()}`:''}</Text>
          <Text style={s.p}>seen {r.seen} · created {r.created} · updated {r.updated} · people {r.matchedPeople} · orgs {r.matchedOrganizations} · links {r.linkedRelationships}</Text>
        </View>)}
      </View>}
    </View>)}
  </ScrollView>;
}
const s=StyleSheet.create({c:{padding:20,gap:12},h:{fontSize:28,fontWeight:'700'},p:{color:'#666'},e:{color:'#b00020'},row:{padding:14,borderWidth:1,borderColor:'#ddd',borderRadius:10,flexDirection:'row',justifyContent:'space-between'},t:{fontWeight:'700'},btn:{padding:8,borderWidth:1,borderRadius:8},btnActive:{borderColor:'#2457D6',backgroundColor:'#EAF0FF'},btnPrimary:{backgroundColor:'#2457D6'},btnDanger:{borderColor:'#B42318'},rowg:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},run:{paddingVertical:6,borderTopWidth:1,borderTopColor:'#eee'}});
