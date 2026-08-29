import { Text, View } from 'react-native';

export default function AuthConfirmedScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: 'white', fontSize: 18, textAlign: 'center' }}>
        メール確認が完了しました
      </Text>
      <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
        （動作確認用の仮画面です）
      </Text>
    </View>
  );
}