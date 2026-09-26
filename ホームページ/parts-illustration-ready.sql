-- ぴのきー。 追加機能（パーツ分け済みイラストの有無）
-- SupabaseのSQL Editorで実行してください。既存データ・既存カラムには影響しません。
--
-- 見積りフォームに「パーツ分けされたイラストがある」というチェック項目を追加します。
-- 料金には影響しない、お客様の状況を伝えるだけの項目です。

alter table public.inquiries add column if not exists parts_illustration_ready boolean;

-- PostgRESTのスキーマキャッシュを更新（反映を確実にするため）
notify pgrst, 'reload schema';
