import { Heading } from '@/components/ui/heading';
import { Link, LinkText } from '@/components/ui/link';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useReplaceAfterDismiss } from '@/hooks/use-replace-after-dismiss';
import { Stack, useRouter } from 'expo-router';
import { TERMS_ENACTED_AT, TERMS_INTRO, TERMS_SECTIONS, TERMS_UPDATED_AT } from './content';

export function Terms() {
  const router = useRouter();
  const replaceAfterDismiss = useReplaceAfterDismiss();
  // Web の再読み込みなどで直接開くと、ヘッダーに戻るボタンが出ない。そのときだけ下端にトップへのリンクを出す
  const canGoBack = router.canGoBack();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
      {/* ヘッダーはルートの Stack で非表示にしているため、この画面だけ表示する。戻るボタンは矢印だけにする */}
      <Stack.Screen
        options={{
          headerShown: true,
          title: '利用規約',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
      <VStack className="w-full max-w-2xl self-center" space="xl">
        <Text size="md">{TERMS_INTRO}</Text>

        {TERMS_SECTIONS.map((section) => (
          <VStack key={section.heading} space="sm">
            <Heading size="sm">{section.heading}</Heading>
            {section.paragraphs?.map((paragraph) => (
              <Text key={paragraph} size="md">
                {paragraph}
              </Text>
            ))}
            {section.items && (
              <VStack space="xs">
                {section.items.map((item) => (
                  <Text key={item} size="md">
                    ・{item}
                  </Text>
                ))}
              </VStack>
            )}
          </VStack>
        ))}

        <VStack space="xs">
          <Text size="sm" className="text-muted-foreground">
            制定日：{TERMS_ENACTED_AT}
          </Text>
          {TERMS_UPDATED_AT !== TERMS_ENACTED_AT && (
            <Text size="sm" className="text-muted-foreground">
              最終改定日：{TERMS_UPDATED_AT}
            </Text>
          )}
        </VStack>

        {!canGoBack && (
          // 未ログインなら、/ から (app) のレイアウトがログイン画面へ移す
          <Link className="self-center" onPress={() => replaceAfterDismiss('/')}>
            <LinkText size="sm">トップへ</LinkText>
          </Link>
        )}
      </VStack>
    </ScrollView>
  );
}
