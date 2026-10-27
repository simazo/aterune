// notifications の行が入ったとき、DB のトリガー(send_push_notification)から呼ばれ、受信者の端末へプッシュ通知を送る。
// 呼び出し元はトリガーだけなので、JWT ではなく共有シークレット(x-send-push-secret)で確かめる(config.toml で verify_jwt = false)。
// 本文には相談内容・メッセージ本文を入れない(Apple / Google のサーバーを通るため)。
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type NotificationType =
  | "session_request_received"
  | "session_request_approved"
  | "session_request_rejected"
  | "session_completed"
  | "review_request"
  | "session_auto_completed"
  | "message_received";

// 通知の種類ごとの文言(name は相手の表示名)。
// body はアプリ内の通知一覧の文言(src/utils/notification-text.ts の NOTIFICATION_TEXTS)と揃えるので、変えるときは両方を直す
const MESSAGES: Record<NotificationType, (name: string) => { title: string; body: string }> = {
  session_request_received: (name) => ({
    title: "新しい申込み",
    body: `${name}さんからセッションの申込みが届きました`,
  }),
  session_request_approved: (name) => ({
    title: "申込みが承認されました",
    body: `${name}さんとのセッションが始まりました`,
  }),
  session_request_rejected: (name) => ({
    title: "申込みが見送られました",
    body: `${name}さんへの申込みは今回は見送られました`,
  }),
  session_completed: (name) => ({
    title: "セッション完了",
    body: `${name}さんとのセッションが完了しました`,
  }),
  review_request: (name) => ({
    title: "レビューのお願い",
    body: `${name}さんへのレビューを書いてみませんか`,
  }),
  session_auto_completed: (name) => ({
    title: "セッション完了",
    body: `${name}さんとのセッションが自動で完了しました`,
  }),
  message_received: (name) => ({
    title: "新しいメッセージ",
    body: `${name}さんからメッセージが届きました`,
  }),
};

// 失敗はトリガー側(pg_net)では見ないので、ここでログに残す(token・個人情報は出さない)
function fail(status: number, message: string) {
  console.error(`send-push: ${message}`);
  return new Response(message, { status });
}

type ExpoPushTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

Deno.serve(async (req) => {
  const secret = Deno.env.get("SEND_PUSH_SECRET");
  if (!secret || req.headers.get("x-send-push-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const notificationId = payload?.notification_id;
  if (typeof notificationId !== "string") {
    return fail(400, "notification_id is required");
  }

  // service role は RLS を越えて、受信者の token・相手の名前を読む
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: notification, error: notificationError } = await supabase
    .from("notifications")
    .select("recipient_id, type, session_id")
    .eq("id", notificationId)
    .maybeSingle();
  if (notificationError) {
    return fail(500, notificationError.message);
  }
  // 送るまでにセッションごと消えた場合など
  if (!notification || !notification.session_id) {
    return new Response(null, { status: 204 });
  }

  const { data: tokens, error: tokensError } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .eq("user_id", notification.recipient_id);
  if (tokensError) {
    return fail(500, tokensError.message);
  }
  if (tokens.length === 0) {
    return new Response(null, { status: 204 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("consultant_id, teller_id")
    .eq("id", notification.session_id)
    .maybeSingle();
  if (sessionError) {
    return fail(500, sessionError.message);
  }
  if (!session) {
    return new Response(null, { status: 204 });
  }

  // 相手＝セッションの当事者のうち、受信者ではない側
  const partnerId = session.consultant_id === notification.recipient_id
    ? session.teller_id
    : session.consultant_id;
  const { data: partner, error: partnerError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", partnerId)
    .maybeSingle();
  if (partnerError) {
    return fail(500, partnerError.message);
  }

  // DB に種別を足してここを直し忘れたときに気づけるよう、飛ばさずに失敗にする
  const buildMessage = MESSAGES[notification.type as NotificationType];
  if (!buildMessage) {
    return fail(500, `unknown notification type: ${notification.type}`);
  }
  const { title, body } = buildMessage(partner?.display_name ?? "退会したユーザー");
  // アプリはタップされたとき session_id から開く画面を決め、recipient_id がログイン中のユーザーと違えば開かない
  // Expo Push API は1回100件までだが、1人の端末がそれを超えることはないので分けずに送る
  const messages = tokens.map(({ expo_push_token }) => ({
    to: expo_push_token,
    title,
    body,
    data: { session_id: notification.session_id, recipient_id: notification.recipient_id },
    sound: "default",
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    return fail(502, `expo push api responded ${res.status}`);
  }

  // アプリを消した端末などの token は、もう届かないので消す(ticket は送った順に返る)
  const { data: tickets } = (await res.json()) as { data?: ExpoPushTicket[] };
  if (!Array.isArray(tickets)) {
    return fail(502, "unexpected response from expo push api");
  }
  const unregistered = tickets.flatMap((ticket, i) =>
    ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
      ? [messages[i].to]
      : []
  );
  if (unregistered.length > 0) {
    const { error: deleteError } = await supabase
      .from("push_tokens")
      .delete()
      .in("expo_push_token", unregistered);
    if (deleteError) {
      return fail(500, deleteError.message);
    }
  }

  return new Response(null, { status: 204 });
});
