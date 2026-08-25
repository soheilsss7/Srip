import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
export async function registerForPushNotifications(){
 if(Platform.OS==='web') return null;
 const current=await Notifications.getPermissionsAsync();
 let status=current.status;
 if(status!=='granted'){status=(await Notifications.requestPermissionsAsync()).status;}
 if(status!=='granted') return null;
 const token=await Notifications.getExpoPushTokenAsync();
 return token.data;
}
export function configureNotificationHandler(){Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:false,shouldSetBadge:true,shouldShowBanner:true,shouldShowList:true})});}
