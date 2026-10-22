import { getMyProfile } from '@/api/profiles';
import { listMySessions } from '@/api/sessions';
import { SelectableButton } from '@/components/selectable-button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/hooks/use-auth';
import { useErrorToast } from '@/hooks/use-error-toast';
import type { SessionListItem } from '@/types';
import { groupSessions, type SessionRole } from '@/utils/group-sessions';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { SessionCard } from './components/session-card';

const ROLE_LABELS: Record<SessionRole, string> = {
  consultant: '相談者として',
  teller: '占い師として',
};

type SectionProps = {
  title: string;
  count: number;
  children: ReactNode;
};

function Section({ title, count, children }: SectionProps) {
  return (
    <VStack space="sm">
      <Heading size="sm">
        {title}（{count}）
      </Heading>
      {children}
    </VStack>
  );
}

// 申込み（承認待ち）から完了までの、自分のセッションの一覧。
// 占い師登録済みの人だけ、上部で「相談者として／占い師として」を切り替える（未登録の人は相談者としての一覧だけ）
export function Messages() {
  const showError = useErrorToast();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isTeller, setIsTeller] = useState(false);
  const [role, setRole] = useState<SessionRole>('consultant');
  // 期限切れの判定と残り時間は、読み込んだ時点の時刻で揃える
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [isEndedOpen, setIsEndedOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 詳細画面で承認・拒否して戻ったときに新しい状態を出すため、画面が表示されるたびに読み直す
  useFocusEffect(
    useCallback(() => {
      // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
      if (!userId) return;
      let isCancelled = false;

      (async () => {
        const [sessionsResult, profileResult] = await Promise.all([
          listMySessions(userId),
          getMyProfile(userId),
        ]);
        if (isCancelled) return;

        if (sessionsResult.error || profileResult.error) {
          showError('やり取りを読み込めませんでした');
        } else {
          setSessions(sessionsResult.data ?? []);
          setIsTeller(profileResult.data.is_teller);
          setLoadedAt(new Date());
        }
        setIsLoading(false);
      })();

      return () => {
        isCancelled = true;
      };
      // showError は描画ごとに作り直されるため依存に入れない
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])
  );

  if (isLoading || !userId) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </VStack>
    );
  }

  // 占い師登録をしていなければ、切り替えは出さず相談者としての一覧だけを見せる
  const currentRole: SessionRole = isTeller ? role : 'consultant';
  const sections = groupSessions(sessions, userId, currentRole, loadedAt);
  const isEmpty =
    sections.awaitingMyReply.length +
      sections.active.length +
      sections.awaitingTheirReply.length +
      sections.ended.length ===
    0;

  // 表示していない側の切り替えボタンには、その側で自分の返事を待っている件数を出す（申込みの見落としを防ぐ）
  function getRoleLabel(target: SessionRole) {
    if (target === currentRole) return ROLE_LABELS[target];
    const count = groupSessions(sessions, userId!, target, loadedAt).awaitingMyReply.length;
    return count > 0 ? `${ROLE_LABELS[target]}（${count}）` : ROLE_LABELS[target];
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
      {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
      <VStack className="w-full max-w-2xl self-center" space="xl">
        {isTeller && (
          <HStack space="xs">
            {(Object.keys(ROLE_LABELS) as SessionRole[]).map((target) => (
              <SelectableButton
                key={target}
                label={getRoleLabel(target)}
                isSelected={currentRole === target}
                onPress={() => setRole(target)}
              />
            ))}
          </HStack>
        )}

        {isEmpty ? (
          <Text size="md" className="text-center text-muted-foreground">
            まだやり取りはありません
          </Text>
        ) : (
          <>
            {sections.awaitingMyReply.length > 0 && (
              <Section title="あなたの返事待ち" count={sections.awaitingMyReply.length}>
                {sections.awaitingMyReply.map((s) => (
                  <SessionCard key={s.id} session={s} kind="pending" now={loadedAt} />
                ))}
              </Section>
            )}

            {sections.active.length > 0 && (
              <Section title="進行中" count={sections.active.length}>
                {sections.active.map((s) => (
                  <SessionCard key={s.id} session={s} kind="active" now={loadedAt} />
                ))}
              </Section>
            )}

            {sections.awaitingTheirReply.length > 0 && (
              <Section title="相手の返事待ち" count={sections.awaitingTheirReply.length}>
                {sections.awaitingTheirReply.map((s) => (
                  <SessionCard key={s.id} session={s} kind="pending" now={loadedAt} />
                ))}
              </Section>
            )}

            {sections.ended.length > 0 && (
              <VStack space="sm">
                {/* 終了したものは件数が増えていくため、最初はたたんでおく */}
                <Pressable
                  onPress={() => setIsEndedOpen((current) => !current)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isEndedOpen }}
                  className="data-[active=true]:opacity-80"
                >
                  <HStack className="items-center justify-between">
                    <Heading size="sm">終了（{sections.ended.length}）</Heading>
                    <Text size="sm" className="text-muted-foreground">
                      {isEndedOpen ? 'たたむ' : '表示する'}
                    </Text>
                  </HStack>
                </Pressable>
                {isEndedOpen &&
                  sections.ended.map((s) => (
                    <SessionCard key={s.id} session={s} kind="ended" now={loadedAt} />
                  ))}
              </VStack>
            )}
          </>
        )}
      </VStack>
    </ScrollView>
  );
}
