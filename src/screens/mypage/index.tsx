import { signOut } from '@/api/auth';
import { getAvatarUrl } from '@/api/avatars';
import { getMyProfile } from '@/api/profiles';
import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Link, LinkText } from '@/components/ui/link';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import { logger } from '@/lib/logger';
import type { Profile } from '@/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

type MyProfile = Pick<Profile, 'display_name' | 'bio' | 'avatar_path' | 'is_teller'>;

export function MyPage() {
  const router = useRouter();
  const showError = useErrorToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
    setIsSigningOut(true);
    try {
      const { error } = await signOut();
      // error が返っても、端末側のログイン状態は消えていてログイン画面に移る（消えないのはサーバー側だけ）。
      // ユーザーから見るとログアウトできているので、伝えずに記録だけする
      if (error) {
        logger.warn('ログアウトのエラー:', error.message);
      }
    } catch (e) {
      // 想定外の例外では、ログイン状態が残っているか分からないので、もう一度押してもらう
      logger.warn('ログアウト中に例外:', e instanceof Error ? e.message : e);
      showError('ログアウトできませんでした');
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isLoading) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </VStack>
    );
  }

  return (
    // 退会のリンクを画面の下端に置くため、中身を画面の高さいっぱいまで伸ばす
    <ScrollView className="flex-1 bg-background" contentContainerClassName="flex-grow p-4">
      {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
      <VStack className="w-full max-w-2xl flex-1 self-center" space="lg">
        {profile ? (
          <Card>
            <VStack space="md">
              <HStack className="items-center" space="md">
                <Avatar size="lg">
                  <AvatarFallbackText>{profile.display_name}</AvatarFallbackText>
                  {profile.avatar_path && <AvatarImage source={{ uri: getAvatarUrl(profile.avatar_path) }} />}
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

        {/* 相談者を含む全員が使う機能なので、占い師向けのカードより先に置く */}
        <Button variant="outline" className="bg-card" onPress={() => router.push('/favorites')}>
          <ButtonText>お気に入りの占い師</ButtonText>
        </Button>
        <Button variant="outline" className="bg-card" onPress={() => router.push('/blocks')}>
          <ButtonText>ブロック中の相談者・占い師</ButtonText>
        </Button>

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
          <Button variant="secondary" onPress={handleSignOut} isDisabled={isSigningOut}>
            {isSigningOut ? <ButtonSpinner /> : <ButtonText>ログアウト</ButtonText>}
          </Button>
        </VStack>

        <VStack className="mt-auto items-center pt-12" space="lg">
          <Link onPress={() => router.push('/help')}>
            <LinkText size="sm">よくある質問・お問い合わせ</LinkText>
          </Link>
          <Link onPress={() => router.push('/terms')}>
            <LinkText size="sm">利用規約</LinkText>
          </Link>
          <Link onPress={() => router.push('/privacy')}>
            <LinkText size="sm">プライバシーポリシー</LinkText>
          </Link>

          {/* 押し間違えないよう、ボタンではなく目立たないリンクにし、ログアウトから離して下端に置く */}
          <Link onPress={() => router.push('/account/delete')}>
            <LinkText size="sm" className="text-muted-foreground">
              退会する
            </LinkText>
          </Link>
        </VStack>
      </VStack>
    </ScrollView>
  );
}
