import React from 'react';
import { Tabs } from 'expo-router';
export default function TabsLayout(){return <Tabs><Tabs.Screen name="index" options={{title:'Home'}}/><Tabs.Screen name="relationships" options={{title:'Relationships'}}/><Tabs.Screen name="meetings" options={{title:'Meetings'}}/><Tabs.Screen name="interactions" options={{title:'Interactions'}}/><Tabs.Screen name="actions" options={{title:'Actions'}}/><Tabs.Screen name="more" options={{title:'More'}}/></Tabs>}
