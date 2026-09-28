-- ぴのきー。 ホームページ改善（制作実績の詳細表示・FAQのカテゴリ）
-- SupabaseのSQL Editorで実行してください。既存データ・既存カラムには影響しません。
-- ALTER TABLE ADD COLUMN IF NOT EXISTS のみを使っています
-- （DROP・TRUNCATE・DELETE・既存テーブルの再作成は一切使っていません）。

-- 制作実績：プラン・可動域・追加オプション（空欄なら公開サイトには表示されません）
alter table public.works add column if not exists plan text default '';
alter table public.works add column if not exists motion text default '';
alter table public.works add column if not exists options text default '';

-- よくある質問：カテゴリ（料金・納期・修正 など。空欄なら「その他」として表示されます）
alter table public.faqs add column if not exists category text default '';

-- PostgRESTのスキーマキャッシュを更新（反映を確実にするため）
notify pgrst, 'reload schema';
