import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Web版は未対応（app.jsonにVAPID公開鍵の設定が必要なため）
  if (Platform.OS === 'web') {
    console.log('プッシュ通知はWeb版では未対応です');
    return null;
  }

  // Android向け：通知チャンネルの作成（必須）
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // 実機のみ対応(シミュレータ/エミュレータは非対応)
  if (!Device.isDevice) {
    console.log('プッシュ通知は実機でのみ動作します');
    return null;
  }

  // 既存の許可状態を確認
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // 未許可なら許可をリクエスト
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('プッシュ通知の許可が得られませんでした');
    return null;
  }

  // Expo Push Token取得
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

  return tokenData.data; // 例："ExponentPushToken[xxxxxxxxxxxx]"
}

export function getCurrentPlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}