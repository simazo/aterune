import { deleteAccount } from '@/api/account';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator,
  CheckboxLabel,
} from '@/components/ui/checkbox';
import { Heading } from '@/components/ui/heading';
import { CheckIcon } from '@/components/ui/icon';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useSuccessToast } from '@/hooks/use-success-toast';
import { logger } from '@/lib/logger';
import { Stack } from 'expo-router';
import { useState } from 'react';

const DELETED_ITEMS = [
  'プロフィール（表示名・自己紹介・アイコン）',
  '生年月日・性別',
  '募集中のお悩み投稿（閉じた状態になります）',
  '承認待ちの申込み（申し込んだもの・申し込まれたものの両方）',
];

const KEPT_ITEMS = [
  'これまでのセッション・メッセージ・レビューは、相手の記録として残ります',
  '相手の画面では、あなたの表示名が「退会したユーザー」と表示されます',
];

function ItemList({ items }: { items: string[] }) {
  return (
    <VStack space="xs">
      {items.map((item) => (
        <Text key={item} size="md">
          ・{item}
        </Text>
      ))}
    </VStack>
  );
}

export function AccountDelete() {
  const showError = useErrorToast();
  const showSuccess = useSuccessToast();
  const [isAgreed, setIsAgreed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const { error } = await deleteAccount();
      if (error === 'has_active_session') {
        showError('進行中のセッションを完了してから退会してください');
        return;
      }
      if (error) {
        showError('退会できませんでした。もう一度お試しください');
        return;
      }
      // ログイン状態が消えるので、(app) のレイアウトがログイン画面へ移す
      showSuccess('退会しました');
    } catch (e) {
      logger.warn('退会中に例外:', e instanceof Error ? e.message : e);
      showError('退会できませんでした。もう一度お試しください');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
      {/* ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする */}
      <Stack.Screen
        options={{
          headerShown: true,
          title: '退会',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
      <VStack className="w-full max-w-2xl self-center" space="lg">
        <Card>
          <VStack space="sm">
            <Heading size="md">退会すると消えるもの</Heading>
            <ItemList items={DELETED_ITEMS} />
          </VStack>
        </Card>

        <Card>
          <VStack space="sm">
            <Heading size="md">退会しても残るもの</Heading>
            <ItemList items={KEPT_ITEMS} />
          </VStack>
        </Card>

        <Card>
          <VStack space="sm">
            <Heading size="md">進行中のセッションがある場合</Heading>
            <Text size="md">
              進行中のセッションがあると退会できません。セッションを完了してから退会してください
            </Text>
          </VStack>
        </Card>

        {/* チェック欄は背景が透明なので、カードの上に置く */}
        <Card>
          <VStack space="lg">
            <Checkbox
              value="agreed"
              isChecked={isAgreed}
              onChange={setIsAgreed}
              isDisabled={isDeleting}
            >
              <CheckboxIndicator>
                <CheckboxIcon as={CheckIcon} />
              </CheckboxIndicator>
              <CheckboxLabel>上記を理解しました</CheckboxLabel>
            </Checkbox>
            <Button
              variant="destructive"
              onPress={handleDelete}
              isDisabled={!isAgreed || isDeleting}
            >
              {isDeleting ? <ButtonSpinner /> : <ButtonText>退会する</ButtonText>}
            </Button>
          </VStack>
        </Card>
      </VStack>
    </ScrollView>
  );
}
