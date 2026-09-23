import { useAuth } from '@/hooks/use-auth';
import { registerForPushNotificationsAsync } from '@/lib/pushToken';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

// TODO: 仮実装。ログイン中であることの確認用の簡易画面。
// 本実装ではフロントエンド設計方針に沿って、screens/配下の実際のホーム画面に置き換える。
export default function AppHomeScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);

    // ログアウト前にトークン削除（RLS上、認証有効なうちに実行する必要がある）
    const token = await registerForPushNotificationsAsync();
    if (token) {
      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('expo_push_token', token);

      if (error) {
        console.log('push_tokens削除エラー:', error.message);
      } else {
        console.log('push_tokens削除成功:', token);
      }
    }

    await supabase.auth.signOut();
    setLoading(false);
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text style={{ color: 'white', fontSize: 16 }}>
        ログイン中: {session?.user.email}
      </Text>
      <Pressable
        onPress={handleSignOut}
        disabled={loading}
        style={{ backgroundColor: '#444', padding: 12, borderRadius: 8 }}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: 'white', textAlign: 'center' }}>ログアウト</Text>
        )}
      </Pressable>
    </View>
  );
}
