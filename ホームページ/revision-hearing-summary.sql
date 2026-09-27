-- ぴのきー。 追加機能（修正追加料金・ヒアリング内容まとめ）
-- SupabaseのSQL Editorで実行してください。既存データ・既存カラムには影響しません。
-- ALTER TABLE ADD COLUMN IF NOT EXISTS のみを使っています（DROP・TRUNCATE・DELETEは使っていません）。

-- 無料修正回数を超えた場合の、1回あたりの追加料金（円）
alter table public.inquiries add column if not exists revision_extra_fee int not null default 0;

-- 依頼BOXでまとめる、お客様への「制作内容のご確認ページ」用のヒアリング内容
alter table public.inquiries add column if not exists hearing_summary text default '';

-- お客様が「制作内容のご確認ページ」で選んだお支払い方法（bank または paypay）
alter table public.inquiries add column if not exists payment_method text;

-- PostgRESTのスキーマキャッシュを更新（反映を確実にするため）
notify pgrst, 'reload schema';
