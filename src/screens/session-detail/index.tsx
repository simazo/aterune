import { getConsultantPrivateDetails } from '@/api/profile-private-details';
import { approveSession, getSession, rejectSession } from '@/api/sessions';
import { Badge, BadgeText } from '@/components/ui/badge';
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
import type { Gender, SessionDetail as SessionDetailData } from '@/types';
import { canSeeConsultantDetails, isOpenPending } from '@/utils/group-sessions';
import {
  formatBirthdateWithAge,
  formatRemaining,
  GENDER_LABELS,
  getEndedLabel,
} from '@/utils/session-display';
import { getSessionResponseErrorMessage } from '@/utils/session-response-error';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RejectDialog } from './components/reject-dialog';

type ConsultantDetails = {
  birthdate: string | null;
  gender: Gender | null;
};

type Props = {
  sessionId: string;
};

// セッション詳細。申込まれた側には、期限内の承認待ちのあいだ承認・拒否のボタンを出す。
// 承認したら画面にとどまり、進行中の表示に切り替える
// TODO: 仮実装。メッセージの送受信と相談者の完了操作は未対応（次の作業で作る）
export function SessionDetail({ sessionId }: Props) {
  const showError = useErrorToast();
  const { session: authSession } = useAuth();
  const userId = authSession?.user.id;
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<SessionDetailData | null>(null);
  // 見てよい状態で、行が無い（未登録）なら null。見てよい状態でない・自分が占い師でないなら undefined
  const [consultantDetails, setConsultantDetails] = useState<ConsultantDetails | null | undefined>();
  // 期限の判定と残り時間は、読み込んだ時点の時刻で揃える
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState<'approve' | 'reject' | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  // セッションと（見てよい状態なら）相談者の情報を読み込む。
  // isCancelled が true を返したら結果を捨てる（別のセッションへ素早く切り替えたとき、古い結果で上書きしない）。
  // 承認・拒否のあとの読み直しで失敗したときは、表示中の内容を残してトーストだけ出す
  const load = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      // (app) のレイアウトがログイン済みを保証しているので、userId が無いことは無い
      if (!userId) return;
      const now = new Date();
      const { data, error } = await getSession(sessionId, userId);
      if (isCancelled()) return;
      if (error || !data) {
        showError('やり取りを読み込めませんでした');
        return;
      }

      let details: ConsultantDetails | null | undefined;
      if (data.teller_id === userId && canSeeConsultantDetails(data, now)) {
        const result = await getConsultantPrivateDetails(data.consultant_id);
        if (isCancelled()) return;
        // 取れなくても詳細は見られるようにする（相談者の情報だけ「表示できません」にする）
        details = result.error ? undefined : result.data;
      }

      setSession(data);
      setConsultantDetails(details);
      setLoadedAt(now);
    },
    // showError は描画ごとに作り直されるため依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, userId]
  );

  useEffect(() => {
    let isCancelled = false;

    (async () => {
      setIsLoading(true);
      // 前のセッションの内容を残さない（読み込みに失敗したら「表示できませんでした」にする）
      setSession(null);
      await load(() => isCancelled);
      if (!isCancelled) setIsLoading(false);
    })();

    return () => {
      isCancelled = true;
    };
  }, [load]);

  async function handleApprove() {
    setSubmittingAction('approve');
    const { error } = await approveSession(sessionId);
    if (error) showError(getSessionResponseErrorMessage(error));
    // 成功・失敗のどちらでも読み直す（成功なら進行中に、期限切れ・処理済みなら最新の状態に変わる）
    await load();
    setSubmittingAction(null);
  }

  async function handleReject() {
    setSubmittingAction('reject');
    const { error } = await rejectSession(sessionId);
    if (error) showError(getSessionResponseErrorMessage(error));
    await load();
    setSubmittingAction(null);
    setIsRejectDialogOpen(false);
  }

  const partnerName = session ? (session.partner_name ?? '退会したユーザー') : '';

  // ヘッダーは (app) の Stack で非表示にしているため、この画面だけ表示する（teller-detail と同じ）
  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: isLoading ? '' : partnerName,
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
  );

  if (isLoading) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background">
        {header}
        <Spinner size="large" />
      </VStack>
    );
  }

  // 存在しない ID・自分のセッションでない（RLS で読めない）・読み込みの失敗
  if (!session || !userId) {
    return (
      <VStack className="flex-1 items-center justify-center bg-background p-4">
        {header}
        <Text size="md" className="text-center text-muted-foreground">
          やり取りを表示できませんでした
        </Text>
      </VStack>
    );
  }

  const isTeller = session.teller_id === userId;
  const isPendingOpen = isOpenPending(session, loadedAt);
  // 占い師から応募して、相談者の承認を待っている間（承認されると相談者の情報が見られるようになる）
  const isWaitingConsultantConsent = isPendingOpen && session.initiated_by === 'teller';
  // 相談者の情報のカードは、見てよい状態か、承認を待っている間だけ出す（拒否・期限切れでは出さない）
  const showsConsultantDetails =
    isTeller && (canSeeConsultantDetails(session, loadedAt) || isWaitingConsultantConsent);
  const canRespond = isPendingOpen && session.recipient_id === userId;
  const statusLabel = isPendingOpen
    ? canRespond
      ? 'あなたの返事待ち'
      : '相手の返事待ち'
    : session.status === 'active'
      ? '進行中'
      : getEndedLabel(session.status);

  return (
    <VStack className="flex-1 bg-background">
      {header}

      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 広い画面（Web）で横に間延びしないよう、幅を抑えて中央に置く */}
        <VStack space="lg" className="w-full max-w-2xl self-center">
          <Card>
            <VStack space="sm">
              <HStack className="flex-wrap items-center" space="sm">
                <Badge variant={session.status === 'active' || canRespond ? 'default' : 'outline'}>
                  <BadgeText>{statusLabel}</BadgeText>
                </Badge>
                {isPendingOpen && (
                  <Text size="sm" className="text-primary">
                    {formatRemaining(session.expires_at, loadedAt)}
                  </Text>
                )}
              </HStack>
              <Text size="sm" className="text-muted-foreground">
                {isTeller ? 'あなたは占い師として参加しています' : 'あなたは相談者として参加しています'}
              </Text>
            </VStack>
          </Card>

          <Card>
            <VStack space="sm">
              <Heading size="md">お悩み</Heading>
              <Text size="md">{session.concern}</Text>
            </VStack>
          </Card>

          {session.applicant_message && (
            <Card>
              <VStack space="sm">
                <Heading size="md">申込み時のひとこと</Heading>
                <Text size="md">{session.applicant_message}</Text>
              </VStack>
            </Card>
          )}

          {showsConsultantDetails && (
            <Card>
              <VStack space="sm">
                <Heading size="md">相談者の情報</Heading>
                {isWaitingConsultantConsent ? (
                  <Text size="sm" className="text-muted-foreground">
                    相談者が承認すると表示されます
                  </Text>
                ) : consultantDetails === undefined ? (
                  <Text size="sm" className="text-muted-foreground">
                    相談者の情報を表示できませんでした
                  </Text>
                ) : (
                  <VStack space="xs">
                    <Text size="md">
                      生年月日：
                      {consultantDetails?.birthdate
                        ? formatBirthdateWithAge(consultantDetails.birthdate, loadedAt)
                        : '未登録'}
                    </Text>
                    <Text size="md">
                      性別：
                      {consultantDetails?.gender ? GENDER_LABELS[consultantDetails.gender] : '回答なし'}
                    </Text>
                  </VStack>
                )}
              </VStack>
            </Card>
          )}

          {session.status === 'active' && (
            <Card>
              <Text size="sm" className="text-muted-foreground">
                メッセージのやり取りは準備中です
              </Text>
            </Card>
          )}
        </VStack>
      </ScrollView>

      {canRespond && (
        // 画面下に固定する。ホームバー（下のセーフエリア）に重ならないよう、その高さの分だけ下に余白を足す
        <VStack
          className="border-t border-border bg-card px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <HStack space="sm" className="w-full max-w-2xl self-center">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 bg-card"
              isDisabled={submittingAction !== null}
              onPress={() => setIsRejectDialogOpen(true)}
            >
              <ButtonText>お断りする</ButtonText>
            </Button>
            <Button
              size="lg"
              className="flex-1"
              isDisabled={submittingAction !== null}
              onPress={handleApprove}
            >
              {submittingAction === 'approve' && <ButtonSpinner />}
              <ButtonText>承認する</ButtonText>
            </Button>
          </HStack>
        </VStack>
      )}

      <RejectDialog
        isOpen={isRejectDialogOpen}
        isSubmitting={submittingAction === 'reject'}
        onClose={() => setIsRejectDialogOpen(false)}
        onConfirm={handleReject}
      />
    </VStack>
  );
}
