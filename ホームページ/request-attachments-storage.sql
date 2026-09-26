-- ぴのきー。 追加機能（依頼フォームの画像添付）
-- SupabaseのSQL Editorで実行してください。既存のテーブル・バケット・データには一切影響しません。
-- このファイルは新しいストレージバケットを1つ作り、それに対する権限を設定するだけです
-- （DROP・TRUNCATE・DELETEは使っていません。既存の portfolio-media バケットも変更しません）。

-- お客様が依頼フォームに添付した画像を保存する、専用の新しいバケット
insert into storage.buckets (id, name, public)
values ('request-attachments', 'request-attachments', true)
on conflict (id) do nothing;

-- 誰でもアップロードできる（お客様がログインなしで送信するため）
drop policy if exists "request_attachments_public_insert" on storage.objects;
create policy "request_attachments_public_insert" on storage.objects
  for insert with check (bucket_id = 'request-attachments');

-- 誰でも読み取れる（公開バケットなので、送信した画像を依頼BOXで表示するため）
drop policy if exists "request_attachments_public_read" on storage.objects;
create policy "request_attachments_public_read" on storage.objects
  for select using (bucket_id = 'request-attachments');
