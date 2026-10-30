import { DocumentPage } from '@/components/document-page';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Link, LinkText } from '@/components/ui/link';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useErrorToast } from '@/hooks/use-error-toast';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { HELP_SECTIONS, SUPPORT_EMAIL } from './content';

// よくある質問と、運営への問い合わせ先。ログインしていなくても開ける（サポート URL として Web でも公開する）
export function Help() {
  const router = useRouter();
  const showError = useErrorToast();

  async function handleContact() {
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
    } catch {
      // メールアプリが無い端末では開けない。アドレスは画面にも出しているので、それを見て送ってもらう
      showError(`メールアプリを開けませんでした。${SUPPORT_EMAIL} までご連絡ください`);
    }
  }

  return (
    <DocumentPage title="よくある質問">
      {HELP_SECTIONS.map((section) => (
        <VStack key={section.heading} space="lg">
          <Heading size="md">{section.heading}</Heading>
          {section.questions.map((item) => (
            <VStack key={item.question} space="xs">
              <Heading size="sm">Q. {item.question}</Heading>
              {item.answers.map((answer) => (
                <Text key={answer} size="md">
                  {answer}
                </Text>
              ))}
            </VStack>
          ))}
        </VStack>
      ))}

      <VStack space="sm">
        <Heading size="md">お問い合わせ</Heading>
        <Text size="md">上で解決しないときは、メールでお問い合わせください。</Text>
        <Text size="md">{SUPPORT_EMAIL}</Text>
        <Button onPress={handleContact}>
          <ButtonText>メールで問い合わせる</ButtonText>
        </Button>
      </VStack>

      <VStack className="items-center" space="lg">
        <Link onPress={() => router.push('/terms')}>
          <LinkText size="sm">利用規約</LinkText>
        </Link>
        <Link onPress={() => router.push('/privacy')}>
          <LinkText size="sm">プライバシーポリシー</LinkText>
        </Link>
      </VStack>
    </DocumentPage>
  );
}
