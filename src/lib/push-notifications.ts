import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from './logger';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Web版は未対応（app.jsonにVAPID公開鍵の設定が必要なため）
  if (Platform.OS === 'web') {
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

  // 許可が得られなければtokenは取得しない
  if (finalStatus !== 'granted') {
    return null;
  }

  return fetchExpoPushToken();
}

// 許可を求めずにこの端末のpush tokenを取得する（許可済みのときだけ返し、それ以外はnull）
// ログアウト時のtoken削除など、許可ダイアログを出したくない場面で使う
export async function getPushTokenIfPermittedAsync(): Promise<string | null> {
  // Web版・シミュレータ/エミュレータではtokenを登録していない
  if (Platform.OS === 'web' || !Device.isDevice) {
    return null;
  }

  // 未許可の端末にはtokenを登録していない
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  return fetchExpoPushToken();
}

// Expo Push Tokenを取得する（許可の確認は呼び出し側で行う）
async function fetchExpoPushToken(): Promise<string> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

  return tokenData.data; // 例："ExponentPushToken[xxxxxxxxxxxx]"
}

// アプリが前面にあるときも通知を出す（設定しないと、前面では何も表示されない）
// Android は shouldPlaySound を false にすると、上から出るバナーも出なくなる
export function setForegroundNotificationHandler() {
  // Web版はプッシュ通知を受け取らない（push tokenを登録していない）
  if (Platform.OS === 'web') return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// 通知欄に出ているこのアプリの通知をすべて消す（ログアウト時に、前のアカウントの通知が見えたままにならないように）
// 失敗してもログアウトの流れを止めないよう、例外は投げない
export async function dismissPushNotifications() {
  // Web版はプッシュ通知を受け取らない
  if (Platform.OS === 'web') return;

  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (e) {
    logger.warn('通知欄の通知を消す処理で例外:', e instanceof Error ? e.message : e);
  }
}

export function getCurrentPlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}
