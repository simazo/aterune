import { signUpWithEmail } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

export function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signUpEmailSent, setSignUpEmailSent] = useState(false);

  async function handleSignUp() {
    setLoading(true);
    setErrorMessage(null);

    if (!displayName.trim()) {
      setErrorMessage('表示名を入力してください');
      setLoading(false);
      return;
    }

    const { error } = await signUpWithEmail(email, password, displayName.trim());

    if (error) {
      setErrorMessage(error.message);
    } else {
      // Confirm email必須のため、この時点ではセッションはまだ確立しない
      setSignUpEmailSent(true);
    }
    setLoading(false);
  }

  if (signUpEmailSent) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text style={{ color: 'white', fontSize: 16, textAlign: 'center' }}>
          確認メールを送信しました。{'\n'}
          メール内のリンクをタップして登録を完了してください。
        </Text>
        <Pressable
          onPress={() => router.replace('/login')}
          style={{ backgroundColor: '#444', padding: 12, borderRadius: 8 }}
        >
          <Text style={{ color: 'white', textAlign: 'center' }}>ログイン画面に戻る</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ color: 'white', fontSize: 20, marginBottom: 12 }}>新規登録</Text>

      <TextInput
        placeholder="表示名"
        placeholderTextColor="#888"
        value={displayName}
        onChangeText={setDisplayName}
        style={{ borderWidth: 1, borderColor: '#555', borderRadius: 8, padding: 12, color: 'white' }}
      />
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
        onPress={handleSignUp}
        disabled={loading}
        style={{ backgroundColor: '#208AEF', padding: 12, borderRadius: 8, marginTop: 8 }}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: 'white', textAlign: 'center' }}>新規登録</Text>
        )}
      </Pressable>
      <Pressable onPress={() => router.replace('/login')}>
        <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 8 }}>ログインはこちら</Text>
      </Pressable>
    </View>
  );
}
