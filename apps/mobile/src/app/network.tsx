import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { apiGet } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

export default function Network(){
 const {token}=useSession();
 const [graph,setGraph]=useState<any>(null); const [analysis,setAnalysis]=useState<any>(null);
 const [connectors,setConnectors]=useState<any[]>([]); const [path,setPath]=useState<any>(null);
 const [error,setError]=useState(''); const [refreshing,setRefreshing]=useState(false);
 const load=useCallback(async()=>{if(!token)return;setError('');try{setGraph(await apiGet('/network/graph',token));}catch(e){setError(e instanceof Error?e.message:'Unable to load network')}},[token]);
 React.useEffect(()=>{load()},[load]);
 const refresh=async()=>{setRefreshing(true);await load();setRefreshing(false)};
 const loadConnectors=async()=>{try{setConnectors(await apiGet('/network/connectors',token))}catch(e){setError(e instanceof Error?e.message:'Connector load failed')}};
 const runPath=async()=>{if(!graph?.nodes?.length)return;try{const from=graph.nodes[0].id;const to=graph.nodes[graph.nodes.length-1].id;setPath(await apiGet(`/network/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=best`,token))}catch(e){setError(e instanceof Error?e.message:'Path failed')}};
 const analyze=async(endpoint:string)=>{try{setAnalysis(await apiGet(`/network/${endpoint}`,token));}catch(e){setError(e instanceof Error?e.message:'Analysis failed')}};
 return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>
  <Text style={styles.title}>Network Intelligence</Text>{error&&<Text style={styles.error}>{error}</Text>}{!graph&&!error&&<ActivityIndicator/>}
  {graph&&<>
   <Text style={styles.subtitle}>{graph.meta.organizationCount} organizations · {graph.meta.peopleCount} people · {graph.meta.projectCount} projects</Text>
   <View style={styles.card}><Text style={styles.label}>Visible nodes</Text>{graph.nodes.slice(0,40).map((n:any)=><View key={n.id} style={{paddingVertical:5}}><Text style={styles.value}>{n.label}</Text><Text style={styles.label}>{n.type}</Text></View>)}</View>
   <View style={styles.card}><Text style={styles.label}>Connection edges</Text>{graph.edges.slice(0,40).map((e:any)=><View key={e.id} style={{paddingVertical:5}}><Text style={styles.value}>{e.source} → {e.target}</Text><Text style={styles.label}>strength {e.weight} · risk {e.risk}</Text></View>)}</View>
   <View style={styles.card}><Text style={styles.label}>Paths and connectors</Text><Pressable style={styles.button} onPress={runPath}><Text style={styles.buttonText}>Best visible path</Text></Pressable><Pressable style={styles.button} onPress={loadConnectors}><Text style={styles.buttonText}>Top connectors</Text></Pressable>{path&&<Text style={styles.value}>{path.found?`${path.hops} hops · cost ${path.totalCost}`:'No visible path found'}</Text>}{connectors.map((x:any)=><Text key={x.node.id} style={styles.value}>{x.node.label} · {x.connectorScore}</Text>)}</View>
   <View style={styles.card}><Text style={styles.label}>Network analysis</Text>{[['centrality','Centrality'],['bridges','Bridge people'],['bottlenecks','Bottlenecks'],['single-points-of-failure','Single points of failure']].map(([key,label])=><Pressable key={key} style={styles.button} onPress={()=>analyze(key)}><Text style={styles.buttonText}>{label}</Text></Pressable>)}{analysis&&<Text style={{marginTop:10,color:colors.muted}}>{JSON.stringify(analysis).slice(0,2500)}</Text>}</View>
  </>}
 </ScrollView></SafeAreaView>
}
