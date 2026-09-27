-- ぴのきー。 追加機能（制作内容のご確認・同意ページ）
-- SupabaseのSQL Editorで実行してください。
-- 既存のテーブル・カラム・関数（get_order_status を含む）には一切変更を加えません。
-- ALTER TABLE ADD COLUMN IF NOT EXISTS と、新しい関数の追加だけを行います。
-- DROP / TRUNCATE / DELETE / 既存テーブルの再作成は一切使っていません。
--
-- ※ 先に supabase/revision-hearing-summary.sql を実行しておいてください
-- （この関数が hearing_summary・revision_extra_fee の列を参照するためです）。
-- すでにこのファイルを1回実行したことがある場合も、再実行して問題ありません
-- （create or replace のため、安全に上書きされます）。

-- ===== 同意状況を保存する列（既存の order_status とは別の、追加の列です） =====
alter table public.inquiries add column if not exists confirmation_agreed_at timestamptz;
alter table public.inquiries add column if not exists confirmation_snapshot jsonb;

-- ===== お客様が自分の依頼の「確認ページ」の内容を見るための関数 =====
-- メールアドレス・スタッフ用メモなど、社内向けの情報は一切返しません。
create or replace function public.get_order_confirmation(p_serial text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'serial', i.serial,
    'request_name', i.request_name,
    'order_status', i.order_status,
    'cancelled', coalesce(i.cancelled, false),
    'created_date', i.created_date,
    'due_date', i.due_date,
    'message', i.message,
    'hearing_summary', i.hearing_summary,
    'plan', i.plan,
    'motion', i.motion,
    'options', i.options,
    'total', coalesce(i.total, 0),
    'base_amount', coalesce(i.base_amount, 0),
    'extra_items', coalesce(i.extra_items, '[]'::jsonb),
    'illustration_needed', coalesce(i.illustration_needed, false),
    'chardesign_needed', coalesce(i.chardesign_needed, false),
    'parts_illustration_ready', coalesce(i.parts_illustration_ready, false),
    'expressions_needed', coalesce(i.expressions_needed, '[]'::jsonb),
    'revision_limit', i.revision_limit,
    'revision_used', coalesce(i.revision_used, 0),
    'revision_extra_fee', coalesce(i.revision_extra_fee, 0),
    'payment_status', i.payment_status,
    'payment_method', i.payment_method,
    'confirmation_agreed_at', i.confirmation_agreed_at
  )
  from public.inquiries i
  where i.serial = p_serial
  limit 1;
$$;

grant execute on function public.get_order_confirmation(text) to anon, authenticated;

-- ===== お客様が「同意する」を押したときに呼び出す関数 =====
-- 二重に同意できないよう、すでに同意済みの場合はサーバー側で弾きます。
-- 更新できる列はこの2つだけに限定されており、他の列は一切変更できません。
create or replace function public.agree_to_confirmation(p_serial text, p_payment_method text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inquiries%rowtype;
  v_now timestamptz := now();
  v_method text := nullif(p_payment_method, '');
begin
  if v_method is not null and v_method not in ('bank', 'paypay') then
    return jsonb_build_object('success', false, 'error', 'invalid_payment_method');
  end if;

  select * into v_row from public.inquiries where serial = p_serial limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if v_row.confirmation_agreed_at is not null then
    return jsonb_build_object('success', false, 'error', 'already_agreed', 'agreed_at', v_row.confirmation_agreed_at);
  end if;

  update public.inquiries
  set confirmation_agreed_at = v_now,
      payment_method = coalesce(v_method, payment_method),
      confirmation_snapshot = jsonb_build_object(
        'plan', v_row.plan,
        'motion', v_row.motion,
        'options', v_row.options,
        'total', coalesce(v_row.total, 0),
        'base_amount', coalesce(v_row.base_amount, 0),
        'extra_items', coalesce(v_row.extra_items, '[]'::jsonb),
        'illustration_needed', coalesce(v_row.illustration_needed, false),
        'chardesign_needed', coalesce(v_row.chardesign_needed, false),
        'payment_method', v_method,
        'agreed_at', v_now
      )
  where serial = p_serial and confirmation_agreed_at is null;

  return jsonb_build_object('success', true, 'agreed_at', v_now);
end;
$$;

grant execute on function public.agree_to_confirmation(text, text) to anon, authenticated;

-- PostgRESTのスキーマキャッシュを更新（反映を確実にするため）
notify pgrst, 'reload schema';
