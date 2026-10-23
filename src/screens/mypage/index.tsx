import { signOut } from '@/api/auth';
import { getMyProfile } from '@/api/profiles';
import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { Profile } from '@/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

type MyProfile = Pick<Profile, 'display_name' | 'bio' | 'avatar_url' | 'is_teller'>;

export function MyPage() {
  const router = useRouter();
  const showError = useErrorToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  // プロフィール編集から戻ったときに新しい内容を出すため、画面が表示されるたびに読み直す
  useFocusEffect(
    useCallback(() => {
      // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
      if (!userId) return;
      let isCancelled = false;

      (async () => {
        const { data, error } = await getMyProfile(userId);
        if (isCancelled) return;

        if (error) {
          showError('プロフィールを読み込めませんでした');
        } else {
          setProfile(data);
        }
        setIsLoading(false);
      })();

      return () => {
        isCancelled = true;
      };
    }, [userId, showError])
  );

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    setLoading(false);
  }

  if (isLoading) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </VStack>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
      {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
      <VStack className="w-full max-w-2xl self-center" space="lg">
        {profile ? (
          <Card>
            <VStack space="md">
              <HStack className="items-center" space="md">
                <Avatar size="lg">
                  <AvatarFallbackText>{profile.display_name}</AvatarFallbackText>
                  {profile.avatar_url && <AvatarImage source={{ uri: profile.avatar_url }} />}
                </Avatar>
                <Heading size="xl" className="flex-1">
                  {profile.display_name}
                </Heading>
              </HStack>
              {profile.bio && <Text size="md">{profile.bio}</Text>}
              <Button variant="outline" onPress={() => router.push('/profile/edit')}>
                <ButtonText>プロフィールを編集</ButtonText>
              </Button>
            </VStack>
          </Card>
        ) : (
          <Text size="md" className="text-center text-muted-foreground">
            プロフィールを表示できませんでした
          </Text>
        )}

        {profile && userId && (
          <Card>
            <VStack space="md">
              <Heading size="md">占い師として</Heading>
              {profile.is_teller ? (
                <>
                  <Button
                    variant="outline"
                    onPress={() => router.push('/teller-profile/edit')}
                  >
                    <ButtonText>占い師プロフィールを編集</ButtonText>
                  </Button>
                  <Button
                    variant="outline"
                    onPress={() =>
                      router.push({ pathname: '/tellers/[id]', params: { id: userId } })
                    }
                  >
                    <ButtonText>自分の占い師ページを見る</ButtonText>
                  </Button>
                </>
              ) : (
                <>
                  <Text size="md">
                    占い師として登録すると、相談者からの申込みを受けたり、お悩みに応募したりできます
                  </Text>
                  <Button onPress={() => router.push('/teller-profile/edit')}>
                    <ButtonText>占い師として登録する</ButtonText>
                  </Button>
                </>
              )}
            </VStack>
          </Card>
        )}

        <VStack space="sm">
          <Text size="sm" className="text-muted-foreground">
            ログイン中: {session?.user.email}
          </Text>
          <Button variant="secondary" onPress={handleSignOut} isDisabled={loading}>
            {loading ? <ButtonSpinner /> : <ButtonText>ログアウト</ButtonText>}
          </Button>
        </VStack>
      </VStack>
    </ScrollView>
  );
}
