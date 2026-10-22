import { listMessages } from '@/api/messages';
import { getConsultantPrivateDetails } from '@/api/profile-private-details';
import { getSessionReview } from '@/api/reviews';
import { approveSession, completeSession, getSession, rejectSession } from '@/api/sessions';
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
import type { Gender, Message, Review, SessionDetail as SessionDetailData } from '@/types';
import { canSeeConsultantDetails, isOpenPending } from '@/utils/group-sessions';
import { canWriteReview } from '@/utils/review';
import {
  formatBirthdateWithAge,
  formatRemaining,
  GENDER_LABELS,
  getEndedLabel,
} from '@/utils/session-display';
import { getSessionResponseErrorMessage } from '@/utils/session-response-error';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
// 引っ張って更新は gluestack-ui に対応する部品が無いため、React Native の RefreshControl を使う（Web では効かない）
import { RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from './components/confirm-dialog';
import { MessageList } from './components/message-list';
import { ReviewCard } from './components/review-card';

type ConsultantDetails = {
  birthdate: string | null;
  gender: Gender | null;
};

type SessionMessage = Pick<Message, 'id' | 'sender_id' | 'content' | 'created_at'>;

type SessionReview = Pick<Review, 'id' | 'rating' | 'comment' | 'created_at'>;

// メッセージがありうる状態（承認されたあと）。承認待ち・拒否・期限切れには無いので取りに行かない
const MESSAGE_STATUSES: SessionDetailData['status'][] = ['active', 'completed', 'auto_completed'];

type Props = {
  sessionId: string;
};

// セッション詳細。申込まれた側には、期限内の承認待ちのあいだ承認・拒否のボタンを出す。
// 承認したら画面にとどまり、進行中の表示に切り替える。
// 承認後はメッセージを並べ、進行中なら「メッセージを書く」（書く画面へ移る）と、相談者には完了のボタンを出す。
// 相談者が完了したら（completed）、レビューを出し、まだ無ければ書ける相談者には「レビューを書く」を出す。
// 相手のメッセージは、画面が表示されたときと、引っ張って更新したときに読み直す（リアルタイムでは受け取らない）
export function SessionDetail({ sessionId }: Props) {
  const router = useRouter();
  const showError = useErrorToast();
  const { session: authSession } = useAuth();
  const userId = authSession?.user.id;
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<SessionDetailData | null>(null);
  // 見てよい状態で、行が無い（未登録）なら null。見てよい状態でない・自分が占い師でないなら undefined
  const [consultantDetails, setConsultantDetails] = useState<ConsultantDetails | null | undefined>();
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  // completed のときだけ読む。まだ無ければ null、読めなかった・completed でないなら undefined
  const [review, setReview] = useState<SessionReview | null | undefined>();
  // 期限の判定と残り時間は、読み込んだ時点の時刻で揃える
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<
    'approve' | 'reject' | 'complete' | null
  >(null);
  const [openDialog, setOpenDialog] = useState<'reject' | 'complete' | null>(null);
  // 最後に読み込みを始めたセッションの ID。別のセッションに切り替わったときだけ、読み込み中の表示にする
  const loadingSessionIdRef = useRef<string | null>(null);
  // 書く画面（メッセージ・レビュー）へ移る途中か。ボタンを素早く何度も押すと、書く画面が重なって開くのを防ぐ
  const isNavigatingRef = useRef(false);

  // セッションと、（見てよい状態なら）相談者の情報・（承認後なら）メッセージ・（完了したら）レビューを読み込む。
  // isCancelled が true を返したら結果を捨てる（別のセッションへ素早く切り替えたとき、古い結果で上書きしない）。
  // 読み直しで失敗したときは、表示中の内容を残してトーストだけ出す
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

      const shouldLoadDetails = data.teller_id === userId && canSeeConsultantDetails(data, now);
      const shouldLoadMessages = MESSAGE_STATUSES.includes(data.status);
      // レビューは相談者が完了した completed にだけ付く（auto_completed には付かない）
      const shouldLoadReview = data.status === 'completed';
      const [detailsResult, messagesResult, reviewResult] = await Promise.all([
        shouldLoadDetails ? getConsultantPrivateDetails(data.consultant_id) : null,
        shouldLoadMessages ? listMessages(sessionId) : null,
        shouldLoadReview ? getSessionReview(sessionId) : null,
      ]);
      if (isCancelled()) return;

      // 取れなくても詳細は見られるようにする（相談者の情報だけ「表示できません」にする）
      const details = detailsResult && !detailsResult.error ? detailsResult.data : undefined;
      if (messagesResult?.error) {
        // メッセージだけ読めなかったときは、表示中のメッセージを残す
        showError('メッセージを読み込めませんでした');
      } else {
        setMessages(messagesResult?.data ?? []);
      }

      setSession(data);
      setConsultantDetails(details);
      // 取れなくても詳細は見られるようにする（レビューだけ「表示できません」にし、書くボタンも出さない）
      setReview(reviewResult && !reviewResult.error ? reviewResult.data : undefined);
      setLoadedAt(now);
    },
    // showError は描画ごとに作り直されるため依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, userId]
  );

  // 書く画面から戻ったときに送ったメッセージを出すため、画面が表示されるたびに読み直す
  useFocusEffect(
    useCallback(() => {
      // 戻ってきたら、また書く画面へ移れるようにする
      isNavigatingRef.current = false;
      let isCancelled = false;
      const isSwitched = loadingSessionIdRef.current !== sessionId;
      loadingSessionIdRef.current = sessionId;

      (async () => {
        if (isSwitched) {
          setIsLoading(true);
          // 前のセッションの内容を残さない（読み込みに失敗したら「表示できませんでした」にする）
          setSession(null);
          setMessages([]);
          setReview(undefined);
        }
        await load(() => isCancelled);
        if (!isCancelled) setIsLoading(false);
      })();

      return () => {
        isCancelled = true;
      };
    }, [load, sessionId])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  function handleWriteMessage() {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    router.push({ pathname: '/sessions/[id]/message', params: { id: sessionId } });
  }

  function handleWriteReview() {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    router.push({ pathname: '/sessions/[id]/review', params: { id: sessionId } });
  }

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
    setOpenDialog(null);
  }

  async function handleComplete() {
    setSubmittingAction('complete');
    const { error } = await completeSession(sessionId);
    if (error) showError(getSessionResponseErrorMessage(error));
    // 成功なら完了に、すでに終わっていれば最新の状態に変わる
    await load();
    setSubmittingAction(null);
    setOpenDialog(null);
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
  const isActive = session.status === 'active';
  // 完了できるのは相談者だけ（DB も相談者以外の完了を弾く）
  const canComplete = isActive && !isTeller;
  // 読めなかった（undefined）ときは、レビュー済みかどうか分からないので書くボタンを出さない
  const canReview =
    review !== undefined && canWriteReview(session, userId, review !== null, loadedAt);
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

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
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
              {canComplete && (
                <Button
                  variant="outline"
                  className="mt-2 self-start bg-card"
                  isDisabled={submittingAction !== null}
                  onPress={() => setOpenDialog('complete')}
                >
                  <ButtonText>相談を完了する</ButtonText>
                </Button>
              )}
            </VStack>
          </Card>

          {session.status === 'completed' && (
            <ReviewCard
              review={review}
              isTeller={isTeller}
              canWrite={canReview}
              completedAt={session.completed_at}
              onWrite={handleWriteReview}
            />
          )}

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

          {MESSAGE_STATUSES.includes(session.status) && (
            <VStack space="md">
              <Heading size="md">メッセージ</Heading>
              <MessageList messages={messages} userId={userId} partnerName={partnerName} />
              {!isActive && (
                <Text size="sm" className="text-center text-muted-foreground">
                  このセッションは終了しているため、メッセージは送れません
                </Text>
              )}
            </VStack>
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
              onPress={() => setOpenDialog('reject')}
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

      {isActive && (
        // 画面下に固定する（入力欄ではなく、書く画面へ移るボタンなのでキーボードには関わらない）
        <VStack
          className="border-t border-border bg-card px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Button
            size="lg"
            className="w-full max-w-2xl self-center"
            isDisabled={submittingAction !== null}
            onPress={handleWriteMessage}
          >
            <ButtonText>メッセージを書く</ButtonText>
          </Button>
        </VStack>
      )}

      <ConfirmDialog
        isOpen={openDialog === 'reject'}
        title="この申込みをお断りしますか？"
        description="お断りすると元に戻せません。相手には結果が通知されます。"
        confirmLabel="お断りする"
        confirmVariant="destructive"
        isSubmitting={submittingAction === 'reject'}
        onClose={() => setOpenDialog(null)}
        onConfirm={handleReject}
      />
      <ConfirmDialog
        isOpen={openDialog === 'complete'}
        title="相談を完了しますか？"
        description="完了すると元に戻せず、メッセージも送れなくなります。これまでのメッセージは読めます。"
        confirmLabel="完了する"
        isSubmitting={submittingAction === 'complete'}
        onClose={() => setOpenDialog(null)}
        onConfirm={handleComplete}
      />
    </VStack>
  );
}
