import React,{useCallback,useEffect,useState}from'react';import{ActivityIndicator,FlatList,Pressable,RefreshControl,SafeAreaView,Text,View}from'react-native';import{apiGet,apiPatch}from'../services/api-client';import{colors,styles}from'../lib/ui';import{useSession}from'../state/session';
type Item={id:string;title:string;body?:string;channel?:string;priority?:string;readAt?:string|null};
export default function Notifications(){
 const{token}=useSession();
 const[rows,setRows]=useState<Item[]>([]);const[unread,setUnread]=useState(0);const[error,setError]=useState<string|null>(null);const[refreshing,setRefreshing]=useState(false);
 const load=useCallback(async()=>{if(!token)return;setError(null);try{const x=await apiGet<any>('/notifications',token);setRows(x.items??(Array.isArray(x)?x:[]));const u=await apiGet<any>('/notifications/unread-count',token);setUnread(typeof u==='number'?u:(u?.count??0))}catch(e){setError(e instanceof Error?e.message:'Request failed')}},[token]);
 useEffect(()=>{load()},[load]);
 const refresh=async()=>{setRefreshing(true);await load();setRefreshing(false)};
 async function read(id:string){if(token)await apiPatch(`/notifications/${id}/read`,{},token);load()}
 async function readAll(){if(token)await apiPatch('/notifications/read-all',{},token);load()}
 return <SafeAreaView style={styles.screen}><FlatList data={rows} keyExtractor={x=>x.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>} contentContainerStyle={styles.content}
  ListHeaderComponent={<View style={{gap:10}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={styles.title}>Notifications</Text><Text style={styles.label}>Unread: {unread}</Text></View>{error&&<Text style={styles.error}>{error}</Text>}{!rows.length&&!error&&<ActivityIndicator/>}<Pressable style={styles.button} onPress={readAll}><Text style={styles.buttonText}>Mark all read</Text></Pressable></View>}
  renderItem={({item})=><View style={styles.card}><Text style={styles.value}>{item.title}</Text><Text style={styles.subtitle}>{item.body}</Text><Text style={styles.label}>{item.channel} · {item.priority}</Text>{!item.readAt&&<Pressable onPress={()=>read(item.id)}><Text style={{color:colors.accent,fontWeight:'700',marginTop:6}}>Mark read</Text></Pressable>}</View>}
  ListEmptyComponent={rows.length===0&&!error?<Text style={{color:colors.muted}}>No notifications yet.</Text>:null}
 /></SafeAreaView>}