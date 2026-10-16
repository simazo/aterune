-- ============================================================
-- 開発用の初期データ(npx supabase db reset / db reset --linked で投入される)
--   1. タグマスタ(占術・回答のスタイル)
--   2. ダミー占い師 5 人(架空。ログイン可。パスワードは全員 password123)
-- ダミーの ID は pgTAP テストの 00000000-... と重ならない 5eed0000-... を使う
-- ============================================================

-- ------------------------------------------------------------
-- 1. タグマスタ
-- ------------------------------------------------------------
insert into public.tags (category, slug, name, sort_order) values
  ('divination', 'tarot',             'タロット',       1),
  ('divination', 'oracle-card',       'オラクルカード', 2),
  ('divination', 'lenormand',         'ルノルマン',     3),
  ('divination', 'playing-card',      'トランプ占い',   4),
  ('divination', 'rune',              'ルーン',         5),
  ('divination', 'shichu-suimei',     '四柱推命',       6),
  ('divination', 'sanmeigaku',        '算命学',         7),
  ('divination', 'numerology',        '数秘術',         8),
  ('divination', 'kyusei-kigaku',     '九星気学',       9),
  ('divination', 'western-astrology', '西洋占星術',     10),
  ('divination', 'sukuyo',            '宿曜占星術',     11),
  ('divination', 'shibi-tosu',        '紫微斗数',       12),
  ('divination', 'mayan-calendar',    'マヤ暦',         13),
  ('divination', 'seimei-handan',     '姓名判断',       14),
  ('divination', 'palmistry',         '手相',           15),
  ('divination', 'face-reading',      '人相',           16),
  ('divination', 'i-ching',           '易',             17),
  ('divination', 'feng-shui',         '風水',           18),
  ('divination', 'kaso',              '家相',           19),
  ('divination', 'spirit-reading',    '霊視',           20),
  ('divination', 'channeling',        'チャネリング',   21),
  ('divination', 'divination-other',  'その他',         22),
  ('style',      'quick',             'サクッと診断',   1),
  ('style',      'in-depth',          'じっくり鑑定',   2),
  ('style',      'direct',            'ズバリ言う',     3),
  ('style',      'gentle',            '優しく寄り添う', 4),
  ('style',      'actionable',        '具体的手順あり', 5);

-- ------------------------------------------------------------
-- 2. ダミー占い師
-- ------------------------------------------------------------
-- auth.users に入れると handle_new_user のトリガーで profiles が作られる(表示名は display_name から)。
-- メールでログインできるよう、確認済み・パスワード設定済みにし、auth.identities も作る。
-- トークン系の列は NULL だと Auth サーバーがログイン時に失敗するため、空文字にする
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', t.id, 'authenticated', 'authenticated', t.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('display_name', t.display_name),
  now(), now(),
  '', '', '', ''
from (values
  ('5eed0000-0000-4000-8000-000000000001'::uuid, 'teller1@aterune.test', '月読みサキ'),
  ('5eed0000-0000-4000-8000-000000000002'::uuid, 'teller2@aterune.test', '星詠みレン'),
  ('5eed0000-0000-4000-8000-000000000003'::uuid, 'teller3@aterune.test', '東雲ミコト'),
  ('5eed0000-0000-4000-8000-000000000004'::uuid, 'teller4@aterune.test', '手相見ハル'),
  ('5eed0000-0000-4000-8000-000000000005'::uuid, 'teller5@aterune.test', '風見ユイ')
) as t (id, email, display_name);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.id::text like '5eed0000-%';

update public.profiles p
   set bio = v.bio
  from (values
    ('5eed0000-0000-4000-8000-000000000001'::uuid, 'カードと対話するのが好きです。'),
    ('5eed0000-0000-4000-8000-000000000002'::uuid, '星の配置から、あなたの流れを読み解きます。'),
    ('5eed0000-0000-4000-8000-000000000003'::uuid, '命式をもとに、人生の大きな流れを一緒に見ていきます。'),
    ('5eed0000-0000-4000-8000-000000000004'::uuid, '手のひらと顔から、今のあなたを読み取ります。'),
    ('5eed0000-0000-4000-8000-000000000005'::uuid, '見えないものの声を、やさしくお伝えします。')
  ) as v (id, bio)
 where p.id = v.id;

-- 受付中／停止中、評価の有無・高低を散らし、検索の絞り込みと並び順を確認できるようにする。
-- average_rating / review_count は本来 reviews のトリガーが更新するキャッシュ値だが、
-- seed ではセッション・レビューを作らず、確認用に直接入れる
insert into public.teller_profiles (profile_id, self_pr, is_accepting, requires_birthdate, average_rating, review_count) values
  ('5eed0000-0000-4000-8000-000000000001', 'タロット歴3年。恋愛・人間関係の相談が得意です。気持ちに寄り添いながら、じっくりお話を伺います。', true,  false, 4.80, 25),
  ('5eed0000-0000-4000-8000-000000000002', '西洋占星術と数秘術で、転機の時期や向いている方向を具体的にお伝えします。', true,  true,  4.20, 10),
  ('5eed0000-0000-4000-8000-000000000003', '四柱推命・算命学を勉強中。生年月日から、性格や運気の流れを丁寧に読み解きます。', false, true,  4.95, 40),
  ('5eed0000-0000-4000-8000-000000000004', '手相・人相の練習中です。写真を見て、短くズバッとお伝えします。', true,  false, null, 0),
  ('5eed0000-0000-4000-8000-000000000005', '霊視・チャネリングで、言葉にならない気持ちを受け取ります。住まいの風水のご相談もどうぞ。', true,  false, 3.50, 4);

insert into public.teller_tags (teller_id, tag_id)
select v.teller_id, t.id
  from (values
    ('5eed0000-0000-4000-8000-000000000001'::uuid, 'tarot'),
    ('5eed0000-0000-4000-8000-000000000001'::uuid, 'oracle-card'),
    ('5eed0000-0000-4000-8000-000000000001'::uuid, 'lenormand'),
    ('5eed0000-0000-4000-8000-000000000001'::uuid, 'gentle'),
    ('5eed0000-0000-4000-8000-000000000001'::uuid, 'in-depth'),
    ('5eed0000-0000-4000-8000-000000000002'::uuid, 'western-astrology'),
    ('5eed0000-0000-4000-8000-000000000002'::uuid, 'numerology'),
    ('5eed0000-0000-4000-8000-000000000002'::uuid, 'mayan-calendar'),
    ('5eed0000-0000-4000-8000-000000000002'::uuid, 'direct'),
    ('5eed0000-0000-4000-8000-000000000002'::uuid, 'actionable'),
    ('5eed0000-0000-4000-8000-000000000003'::uuid, 'shichu-suimei'),
    ('5eed0000-0000-4000-8000-000000000003'::uuid, 'sanmeigaku'),
    ('5eed0000-0000-4000-8000-000000000003'::uuid, 'kyusei-kigaku'),
    ('5eed0000-0000-4000-8000-000000000003'::uuid, 'seimei-handan'),
    ('5eed0000-0000-4000-8000-000000000003'::uuid, 'in-depth'),
    ('5eed0000-0000-4000-8000-000000000003'::uuid, 'actionable'),
    ('5eed0000-0000-4000-8000-000000000004'::uuid, 'palmistry'),
    ('5eed0000-0000-4000-8000-000000000004'::uuid, 'face-reading'),
    ('5eed0000-0000-4000-8000-000000000004'::uuid, 'i-ching'),
    ('5eed0000-0000-4000-8000-000000000004'::uuid, 'quick'),
    ('5eed0000-0000-4000-8000-000000000004'::uuid, 'direct'),
    ('5eed0000-0000-4000-8000-000000000005'::uuid, 'spirit-reading'),
    ('5eed0000-0000-4000-8000-000000000005'::uuid, 'channeling'),
    ('5eed0000-0000-4000-8000-000000000005'::uuid, 'feng-shui'),
    ('5eed0000-0000-4000-8000-000000000005'::uuid, 'kaso'),
    ('5eed0000-0000-4000-8000-000000000005'::uuid, 'gentle'),
    ('5eed0000-0000-4000-8000-000000000005'::uuid, 'quick')
  ) as v (teller_id, slug)
  join public.tags t on t.slug = v.slug;
