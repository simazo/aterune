import {
    getCurrentPlatform,
    registerForPushNotificationsAsync,
} from '@/lib/pushToken';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

type Props = {
  session: Session | null;
};

export function AuthScreen({ session }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      // ログイン成功 → push token登録
      await registerPushToken();
    }
    setLoading(false);
  }

  async function registerPushToken() {
    const token = await registerForPushNotificationsAsync();
    if (!token) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform: getCurrentPlatform(),
      },
      { onConflict: 'user_id,expo_push_token', ignoreDuplicates: true }
    );

    if (error) {
      console.log('push_tokens登録エラー:', error.message);
    } else {
      console.log('push_tokens登録成功:', token);
    }
  }

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

  if (session) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text style={{ color: 'white', fontSize: 16 }}>
          ログイン中: {session.user.email}
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

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ color: 'white', fontSize: 20, marginBottom: 12 }}>ログイン</Text>
      <TextInput
        placeholder="メールアドレス"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: '#555', borderRadius: 8, padding: 12, color: 'white' }}
      />
      <TextInput
        placeholder="パスワード"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, borderColor: '#555', borderRadius: 8, padding: 12, color: 'white' }}
      />
      {errorMessage && <Text style={{ color: '#ff6b6b' }}>{errorMessage}</Text>}
      <Pressable
        onPress={handleSignIn}
        disabled={loading}
        style={{ backgroundColor: '#208AEF', padding: 12, borderRadius: 8, marginTop: 8 }}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: 'white', textAlign: 'center' }}>ログイン</Text>
        )}
      </Pressable>
    </View>
  );
}