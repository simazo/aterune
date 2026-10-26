// アプリの退会確認画面から functions.invoke で呼ばれ、ログイン中のユーザーを退会させる(論理削除)。
// auth のユーザー削除には service role が要るため、アプリではなくここで行う。
// 呼び出し元はログイン中のユーザーだけなので、config.toml で verify_jwt を有効にしたまま(既定)にする。
//   1. Authorization ヘッダーの JWT から本人を特定する
//   2. DB 側の処理(prepare_account_deletion)。進行中のセッションがあれば 409 を返す
//   3. auth のユーザーを論理削除する(auth.users の行は残るので、セッションなどの記録は連鎖削除されない)
// 2 が成功して 3 が失敗しても、prepare_account_deletion は何度呼んでも同じ結果になるので、もう一度退会すれば片付く。
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

// アプリはこの値を見て、進行中のセッションがあることを伝える
type DeleteAccountError = "unauthorized" | "has_active_session" | "failed";

// 成功時も本文を返す。functions.invoke は Content-Type が application/json だと本文を JSON として読むため、
// 空の本文ではアプリ側でエラーになる
function json(status: number, body: { error: DeleteAccountError | null }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// 想定外の失敗はアプリに理由を返さないので、ここでログに残す(個人情報は出さない)
function fail(message: string) {
  console.error(`delete-account: ${message}`);
  return json(500, { error: "failed" });
}

Deno.serve(async (req) => {
  // Web のアプリ(ブラウザ)から呼ぶため、CORS の事前確認に答える
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // functions.invoke の既定は POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const token = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!token) {
    return json(401, { error: "unauthorized" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // getUser は Auth のサーバーに問い合わせるので、退会済み(論理削除済み)のユーザーも弾ける
  // Auth のサーバーの障害や通信の失敗は、ログインしていない扱いにせず 500 にする。
  // 退会済みのユーザーのトークンでは AuthApiError ではなく AuthSessionMissingError が返る
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  const isUnauthorized = isAuthSessionMissingError(userError) ||
    (isAuthApiError(userError) && userError.status < 500);
  if (userError && !isUnauthorized) {
    return fail(userError.message);
  }
  if (userError || !user) {
    return json(401, { error: "unauthorized" });
  }

  // service role から呼ぶので auth.uid() は null になり、pending → expired への遷移が通る
  const { error: prepareError } = await supabase.rpc("prepare_account_deletion", {
    p_user_id: user.id,
  });
  if (prepareError) {
    // 文言は prepare_account_deletion の raise exception と同じ。pgTAP(prepare_account_deletion.test.sql)の
    // throws_ok で固定しているので、DB 側で変えればテストが落ちて気づける
    if (prepareError.message === "the user has an active session") {
      return json(409, { error: "has_active_session" });
    }
    return fail(prepareError.message);
  }

  // 第2引数 true で論理削除にする
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id, true);
  if (deleteError) {
    return fail(deleteError.message);
  }

  return json(200, { error: null });
});
