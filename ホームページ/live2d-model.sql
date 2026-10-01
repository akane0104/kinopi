-- ぴのきー。 追加機能（モデル紹介でのLive2Dインタラクティブ表示・体験版）
-- SupabaseのSQL Editorで実行してください。既存データ・既存カラムには影響しません。
-- ALTER TABLE ADD COLUMN IF NOT EXISTS のみを使っています
-- （DROP・TRUNCATE・DELETE・既存テーブルの再作成は一切使っていません）。
--
-- まずは「モデル紹介」だけに対応しています（販売中モデル・制作実績にはまだ入れていません）。

-- Live2Dモデルのメイン設定ファイル（***.model3.json）の公開URL
alter table public.models add column if not exists live2d_model_url text;

-- 表情・モーションのボタン一覧（key/グループ名・表示ラベル をまとめて保存）
alter table public.models add column if not exists live2d_assets jsonb;

notify pgrst, 'reload schema';
