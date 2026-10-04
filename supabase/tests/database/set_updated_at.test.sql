begin;
select plan(2);

-- テスト用の一時テーブル(トランザクションの最後に消える)
create temp table t (id int, updated_at timestamptz default '2000-01-01');

create trigger t_set_updated_at
  before update on t
  for each row execute function public.set_updated_at();

insert into t values (1);

-- ① 更新前は古い日時のまま
select is(
  (select updated_at from t),
  '2000-01-01'::timestamptz,
  'insert 時点では updated_at は変わらない'
);

-- ② 更新すると新しい日時になる
update t set id = 2;

select ok(
  (select updated_at from t) > '2000-01-01',
  'update すると set_updated_at が updated_at を現在時刻にする'
);

select * from finish();
rollback;