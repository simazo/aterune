import { getMyPrivateDetails } from '@/api/profile-private-details';
import { getMyProfile } from '@/api/profiles';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { Gender } from '@/types';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ProfileEditForm } from './components/profile-edit-form';

type LoadedProfile = {
  displayName: string;
  bio: string | null;
  birthdate: string | null;
  gender: Gender | null;
};

export function ProfileEdit() {
  const showError = useErrorToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
    if (!userId) return;
    let isCancelled = false;

    (async () => {
      const [profileResult, detailsResult] = await Promise.all([
        getMyProfile(userId),
        getMyPrivateDetails(userId),
      ]);
      if (isCancelled) return;

      // どちらかが読めないまま保存すると、読めなかった方を空の値で上書きしてしまうため、フォームを出さない
      if (profileResult.error || detailsResult.error) {
        showError('プロフィールを読み込めませんでした');
      } else {
        setProfile({
          displayName: profileResult.data.display_name,
          bio: profileResult.data.bio,
          birthdate: detailsResult.data?.birthdate ?? null,
          gender: detailsResult.data?.gender ?? null,
        });
      }
      setIsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
  }, [userId, showError]);

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする
  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'プロフィール編集',
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
  );

  if (isLoading || !userId) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        {header}
        <Spinner size="large" />
      </VStack>
    );
  }

  if (!profile) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background p-4">
        {header}
        <Text size="md" className="text-center text-muted-foreground">
          プロフィールを表示できませんでした
        </Text>
      </VStack>
    );
  }

  return (
    <VStack className="flex-1 bg-background">
      {header}
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
        <VStack className="w-full max-w-2xl self-center">
          <ProfileEditForm
            userId={userId}
            displayName={profile.displayName}
            bio={profile.bio}
            savedBirthdate={profile.birthdate}
            savedGender={profile.gender}
          />
        </VStack>
      </KeyboardAwareScrollView>
    </VStack>
  );
}
