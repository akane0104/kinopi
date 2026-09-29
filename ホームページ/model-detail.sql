-- ぴのきー。 モデル紹介・販売中モデルの「詳細ページ」用の列
-- SupabaseのSQL Editorで実行してください。既存データ・既存カラムには影響しません。
-- ALTER TABLE ADD COLUMN IF NOT EXISTS のみを使っています
-- （DROP・TRUNCATE・DELETE・既存テーブルの再作成は一切使っていません）。

-- タグ・制作内容の表・動きのサブ画像・表情の変化・こだわりポイント をまとめて保存する列
alter table public.models add column if not exists detail jsonb;
alter table public.products add column if not exists detail jsonb;

-- PostgRESTのスキーマキャッシュを更新（反映を確実にするため）
notify pgrst, 'reload schema';

-- 担当者名（公開サイトに表示する制作担当の名前。空欄なら表示されません）
alter table public.works add column if not exists staff_name text default '';
alter table public.models add column if not exists staff_name text default '';
alter table public.products add column if not exists staff_name text default '';

notify pgrst, 'reload schema';
