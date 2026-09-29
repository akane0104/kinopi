const configured = Boolean(window.PINOKII_SUPABASE?.url && window.PINOKII_SUPABASE?.anonKey);
const db = configured && window.supabase ? window.supabase.createClient(window.PINOKII_SUPABASE.url, window.PINOKII_SUPABASE.anonKey) : null;
let data = { settings: {}, plans: [], motions: [], options: [], works: [], models: [], faqs: [], products: [], reviews: [] };
const $ = (selector) => document.querySelector(selector);
const message = (form, text, isError = false) => { const target = form.querySelector('.form-message'); if (target) { target.textContent = text; target.style.color = isError ? '#c14978' : '#579578'; } showToast(text, isError); };

/* ===== 追加機能：保存結果を見逃しにくいトースト通知で表示 ===== */
function showToast(text, isError = false) {
  if (!text) return;
  let toast = document.getElementById('admin-toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'admin-toast'; document.body.appendChild(toast); }
  toast.textContent = text;
  toast.className = `is-visible ${isError ? 'is-error' : ''}`;
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}
const toObject = (form) => Object.fromEntries(new FormData(form).entries());

function showApp(session) { $('#setup-message').hidden = true; $('#login-panel').hidden = Boolean(session); $('#admin-panel').hidden = !session; if (session) loadAll(); }
async function checkAuth() { if (!configured) { $('#setup-message').hidden = false; return; } const { data: { session } } = await db.auth.getSession(); showApp(session); }
async function loadAll() {
  const [settings, plans, motions, options, works, models, faqs, products, reviews] = await Promise.all([db.from('site_settings').select('*'), db.from('plans').select('*').order('sort_order'), db.from('motions').select('*').order('sort_order'), db.from('options').select('*').order('sort_order'), db.from('works').select('*').order('sort_order'), db.from('models').select('*').order('sort_order'), db.from('faqs').select('*').order('sort_order'), db.from('products').select('*').order('sort_order'), db.from('reviews').select('*').order('sort_order')]);
  data.settings = Object.fromEntries((settings.data || []).map((item) => [item.key, item.value])); data.plans = plans.data || []; data.motions = motions.data || []; data.options = options.data || []; data.works = works.data || []; data.models = models.data || []; data.faqs = faqs.data || []; data.products = products.data || []; data.reviews = reviews.data || [];
  fillSettings(); fillFees(); fillLegal(); fillAddon(); renderAll();
}
function fillSettings() { const form = $('#settings-form'); Object.entries(data.settings).forEach(([key, value]) => { const field = form.elements[key]; if (!field) return; if (field.type === 'checkbox') field.checked = value === true || value === 'true' || value === undefined; else field.value = value ?? ''; }); updateCouponPreview(); }
/* ===== 追加機能：クーポンバナーを直感的に編集できるライブプレビュー ===== */
function updateCouponPreview() {
  const form = $('#settings-form');
  const preview = $('#coupon-preview');
  if (!form || !preview) return;
  const label = form.elements.coupon_label.value || '（表示文を入力してください）';
  const percent = form.elements.coupon_percent.value || '0';
  const enabled = form.elements.coupon_enabled ? form.elements.coupon_enabled.checked : true;
  $('#coupon-preview-label').textContent = label;
  $('#coupon-preview-percent').textContent = percent;
  preview.style.opacity = enabled ? '1' : '.35';
  preview.title = enabled ? '' : 'クーポン表示はオフになっています（バナーは非表示になります）';
}
document.addEventListener('input', (event) => { if (['coupon_label', 'coupon_percent'].includes(event.target.name)) updateCouponPreview(); });
document.addEventListener('change', (event) => { if (event.target.name === 'coupon_enabled') updateCouponPreview(); });
function thumbnail(item) { return item.cover_url ? `<img class="thumb" src="${item.cover_url}" alt="" />` : '<span class="thumb"></span>'; }
/* ===== 画像が粗く見える原因を見つけやすくする：小さい画像にバッジを付ける ===== */
const THUMB_MIN_WIDTH = 1000; // works/models/products のカード・詳細表示は大きめに出るため、この幅未満は「粗く見えるおそれ」として警告
function flagSmallImages(container) {
  container.querySelectorAll('img.thumb').forEach((img) => {
    if (img.dataset.checked) return;
    const check = () => {
      img.dataset.checked = 'true';
      if (img.naturalWidth && img.naturalWidth < THUMB_MIN_WIDTH) {
        img.insertAdjacentHTML('afterend', `<small class="thumb-warn">⚠ 画像が小さめです（${img.naturalWidth}×${img.naturalHeight}px）。サイト上で粗く見えている場合は、横${THUMB_MIN_WIDTH}px以上の画像に差し替えると改善します。</small>`);
      }
    };
    if (img.complete && img.naturalWidth) check(); else img.addEventListener('load', check, { once: true });
  });
}
function entityCards(type) { const list = $(`#${type}-admin-list`); list.innerHTML = (data[type] || []).map((item) => `<article class="admin-card">${thumbnail(item)}<div><b>${item.title || item.name}</b><small>${item.credit || item.category || ''} ${item.is_public ? '' : '／非公開'}</small></div><div class="admin-card-actions"><button class="edit-button" data-edit="${type}" data-id="${item.id}">編集</button>${type === 'models' ? `<button class="edit-button" data-detail-edit="models" data-id="${item.id}">詳細ページ</button>` : ''}<button class="delete-button" data-delete="${type}" data-id="${item.id}">削除</button></div></article>`).join('') || '<p class="empty-text">まだ登録がありません。</p>'; }
function priceRows(type) { return data[type].map((item) => `<div class="price-row"><b>${item.name}</b><input type="number" value="${item.price ?? ''}" data-price="${type}" data-id="${item.id}" /><button data-save-price="${type}" data-id="${item.id}">保存</button></div>`).join('') || '<p class="empty-text">項目がありません。</p>'; }
function mediaThumb(item) {
  if (!item.media_url) return '<span class="thumb"></span>';
  return item.media_type === 'video' ? `<video class="thumb" src="${item.media_url}" muted></video>` : `<img class="thumb" src="${item.media_url}" alt="" />`;
}
function optionCards() { const list = $('#options-admin-list'); list.innerHTML = data.options.map((item) => `<article class="admin-card">${mediaThumb(item)}<div><b>${item.name} ${item.active ? '' : '（非表示）'}</b><small>${item.price === null ? '要お見積り' : `¥${Number(item.price).toLocaleString('ja-JP')}`} ／ ${item.high_only ? '高可動域のみ' : '全可動域'} ／ ${item.description || ''}</small></div><div class="admin-card-actions"><button class="edit-button" data-edit="options" data-id="${item.id}">編集</button><button class="delete-button" data-delete="options" data-id="${item.id}">削除</button></div></article>`).join('') || '<p class="empty-text">まだ登録がありません。</p>'; }
function planCards() { const list = $('#plans-admin-list'); if (!list) return; list.innerHTML = data.plans.map((item) => `<article class="admin-card"><div><b>${item.name}</b><small>¥${Number(item.price || 0).toLocaleString('ja-JP')} ／ ${item.description || ''}</small></div><div class="admin-card-actions"><button class="edit-button" data-edit="plans" data-id="${item.id}">編集</button><button class="delete-button" data-delete="plans" data-id="${item.id}">削除</button></div></article>`).join('') || '<p class="empty-text">まだ登録がありません。</p>'; }
function motionCards() { const list = $('#motions-admin-list'); list.innerHTML = data.motions.map((item) => `<article class="admin-card">${mediaThumb(item)}<div><b>${item.name}</b><small>¥${Number(item.price || 0).toLocaleString('ja-JP')} ／ ${item.description || ''}</small></div><div class="admin-card-actions"><button class="edit-button" data-edit="motions" data-id="${item.id}">編集</button><button class="delete-button" data-delete="motions" data-id="${item.id}">削除</button></div></article>`).join('') || '<p class="empty-text">まだ登録がありません。</p>'; }
function reviewCards() { const list = $('#reviews-admin-list'); list.innerHTML = data.reviews.map((item) => `<article class="admin-card"><div><b>${'★'.repeat(Number(item.rating || 5))}${'☆'.repeat(5 - Number(item.rating || 5))} ${item.author_name} ${item.is_public ? '' : '（非公開）'}</b><small>${item.comment || ''}</small></div><div class="admin-card-actions"><button class="edit-button" data-edit="reviews" data-id="${item.id}">編集</button><button class="delete-button" data-delete="reviews" data-id="${item.id}">削除</button></div></article>`).join('') || '<p class="empty-text">まだ登録がありません。</p>'; }
function renderOverview() { const target = $('#content-overview'); const coupon = data.settings.coupon_percent ?? 30; const hero = data.settings.hero_title || '看板モデルは未設定'; target.innerHTML = `<div class="overview-heading"><div><p class="section-tag">what's on your site <span>✦</span></p><h2>いまサイトにあるもの</h2></div><p>カードを押すと、追加・編集する場所へ移動します。</p></div><div class="overview-grid"><a href="#site-settings" class="overview-card pink"><span>♡</span><small>トップページ</small><b>${hero}</b><em>看板モデル・クーポン・連絡先を編集 →</em></a><a href="#manage-works" class="overview-card lavender"><span>✦</span><small>制作実績</small><b>${data.works.length} 件</b><em>${data.works.length ? '掲載中の実績を編集 →' : '最初の実績を追加 →'}</em></a><a href="#manage-models" class="overview-card mint"><span>◌</span><small>モデル紹介</small><b>${data.models.length} 体</b><em>${data.models.length ? '掲載中のモデルを編集 →' : '最初のモデルを追加 →'}</em></a><a href="#manage-prices" class="overview-card yellow"><span>¥</span><small>料金・オプション</small><b>${data.plans.length} プラン / ${data.options.length} 項目</b><em>現在 ${coupon}% OFF・価格を編集 →</em></a><a href="admin-inquiries.html" class="overview-card pink"><span>♡</span><small>依頼BOX</small><b>依頼と相談を確認</b><em>シリアルナンバーで管理 →</em></a></div>`; }
const LEGAL_KEYS = ['legal_business_name', 'legal_representative', 'legal_address', 'legal_phone', 'legal_email', 'legal_price_note', 'legal_extra_fees', 'legal_payment_methods', 'legal_payment_timing', 'legal_delivery_time', 'legal_return_policy', 'legal_other'];
function fillLegal() { const form = $('#legal-form'); if (!form) return; LEGAL_KEYS.forEach((key) => { if (form.elements[key]) form.elements[key].value = data.settings[key] ?? ''; }); }
async function saveLegal(event) { event.preventDefault(); const form = event.currentTarget; try { const values = toObject(form); const rows = Object.entries(values).map(([key, value]) => ({ key, value })); const { error } = await db.from('site_settings').upsert(rows); if (error) throw error; message(form, '保存しました！'); await loadAll(); } catch (error) { message(form, `保存できませんでした：${error.message}`, true); } }
const ADDON_TEXT_DEFAULT = `・Live2Dモデルに衣装を追加したい
・既存モデルの髪型を変更したい
・髪色や目の色を変更したい
・表情やポーズを追加したい
・既存イラストから配信素材を作りたい
・今あるイラストをLive2D用にパーツ分けしたい
・以前制作したモデルに新しい要素を追加したい

など、既存のイラストやLive2Dモデルへの追加制作も承ります。

「こんなの作れる？」というご相談もお気軽にどうぞ。`;
function fillAddon() { const form = $('#addon-form'); if (!form) return; if (form.elements.addon_customization_text) form.elements.addon_customization_text.value = data.settings.addon_customization_text ?? ADDON_TEXT_DEFAULT; }
async function saveAddon(event) { event.preventDefault(); const form = event.currentTarget; try { const values = toObject(form); const { error } = await db.from('site_settings').upsert({ key: 'addon_customization_text', value: values.addon_customization_text }); if (error) throw error; message(form, '保存しました！'); await loadAll(); } catch (error) { message(form, `保存できませんでした：${error.message}`, true); } }
const FEE_KEYS = ['illustration_label', 'illustration_toggle_text', 'illustration_desc', 'illustration_price_min', 'illustration_price_max', 'chardesign_label', 'chardesign_toggle_text', 'chardesign_desc', 'chardesign_price_min', 'chardesign_price_max', 'parts_ready_label', 'parts_ready_toggle_text', 'parts_ready_desc'];
function fillFees() {
  const form = $('#fees-form');
  if (!form) return;
  FEE_KEYS.forEach((key) => { if (form.elements[key]) form.elements[key].value = data.settings[key] ?? ''; });
  if (form.elements.chardesign_enabled) form.elements.chardesign_enabled.checked = data.settings.chardesign_enabled === true || data.settings.chardesign_enabled === 'true' || data.settings.chardesign_enabled === undefined;
  updateLabelPreview();
}
function updateLabelPreview() {
  const form = $('#fees-form');
  if (!form) return;
  const illustPreview = $('#illustration-label-preview');
  const chardesPreview = $('#chardesign-label-preview');
  const partsReadyPreview = $('#parts-ready-label-preview');
  if (illustPreview) illustPreview.textContent = form.elements.illustration_toggle_text.value.trim() || 'イラスト制作をお願いしたい';
  if (chardesPreview) chardesPreview.textContent = form.elements.chardesign_toggle_text.value.trim() || 'キャラクターデザインをお願いしたい';
  if (partsReadyPreview) partsReadyPreview.textContent = form.elements.parts_ready_toggle_text.value.trim() || 'パーツ分けされたイラストがあります';
}
document.addEventListener('input', (event) => { if (['illustration_toggle_text', 'chardesign_toggle_text', 'parts_ready_toggle_text'].includes(event.target.name)) updateLabelPreview(); });
async function saveFees(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const values = toObject(form);
    if (form.elements.chardesign_enabled) values.chardesign_enabled = form.elements.chardesign_enabled.checked ? 'true' : 'false';
    const numericKeys = new Set(['illustration_price_min', 'illustration_price_max', 'chardesign_price_min', 'chardesign_price_max']);
    const rows = Object.entries(values).map(([key, value]) => ({ key, value: numericKeys.has(key) ? Number(value || 0) : value }));
    const { error } = await db.from('site_settings').upsert(rows);
    if (error) throw error;
    message(form, '保存しました！');
    await loadAll();
  } catch (error) { message(form, `保存できませんでした：${error.message}`, true); }
}
function productCards() { const list = $('#products-admin-list'); list.innerHTML = data.products.map((item) => `<article class="admin-card">${thumbnail(item)}<div><b>${item.name} ${item.is_sold ? '＜販売済み＞' : ''}</b><small>${item.price === null || item.price === undefined || item.price === '' ? '要お見積り' : `¥${Number(item.price).toLocaleString('ja-JP')}`} ${item.is_public ? '' : '／非公開'}</small></div><div class="admin-card-actions"><button class="edit-button" data-edit="products" data-id="${item.id}">編集</button><button class="edit-button" data-detail-edit="products" data-id="${item.id}">詳細ページ</button><button class="delete-button" data-delete="products" data-id="${item.id}">削除</button></div></article>`).join('') || '<p class="empty-text">まだ出品していません。</p>'; }
function renderAll() { renderOverview(); entityCards('works'); entityCards('models'); productCards(); planCards(); motionCards(); optionCards(); faqCards(); reviewCards(); flagSmallImages(document); updateNavBadges(); }

/* ===== 追加機能：サイドナビの件数バッジ ===== */
function updateNavBadges() {
  const counts = {
    works: data.works.length,
    models: data.models.length,
    prices: data.plans.length + data.motions.length + data.options.length,
    products: data.products.length,
    faqs: data.faqs.length,
    reviews: data.reviews.length
  };
  Object.entries(counts).forEach(([key, count]) => {
    const el = document.querySelector(`.nav-badge[data-count="${key}"]`);
    if (el) el.textContent = count ? String(count) : '';
  });
}
function faqCards() { const list = $('#faqs-admin-list'); list.innerHTML = data.faqs.map((item) => `<article class="admin-card"><div><b>${item.question}</b><small>${item.answer || ''}</small></div><div class="admin-card-actions"><button class="edit-button" data-edit="faqs" data-id="${item.id}">編集</button><button class="delete-button" data-delete="faqs" data-id="${item.id}">削除</button></div></article>`).join('') || '<p class="empty-text">まだ登録がありません。公開サイトにはサンプルの質問が表示されます。</p>'; }
function imageSize(file) { return new Promise((resolve) => { const img = new Image(); const url = URL.createObjectURL(file); img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); }; img.onerror = () => resolve({ width: 0, height: 0 }); img.src = url; }); }
async function upload(file, minWidth = 1000, label = '', aspectHint = '') { if (!file) return '';
  if (file.type.startsWith('image/')) { const dims = await imageSize(file); if (dims.width && dims.width < minWidth) { const goOn = confirm(`この画像は ${dims.width}×${dims.height}px です。\n${label ? `${label}は` : 'この場所は'}サイト上で大きく表示されるため、横${minWidth}px以上の画像を推奨しています。\nスマホやパソコンの高精細な画面では、それより小さい画像は輪郭がぼやけたり粗く（がびがびに）見えることがあります。\n\nこのままアップロードしますか？（OK＝続行／キャンセル＝中止）`); if (!goOn) throw new Error('アップロードを中止しました。より大きい画像を選んでください。'); } if (aspectHint && dims.width && dims.height) { const ratio = dims.width / dims.height; const isExtreme = ratio > 2.2 || ratio < 0.45; if (isExtreme) { const goOn2 = confirm(`この画像はかなり横長（または縦長）です（${dims.width}×${dims.height}px）。\n${label ? `${label}は` : 'この場所は'}${aspectHint}\n表示エリアからはみ出た部分は自動でトリミングされ、被写体が中央からずれていると切れて見えることがあります。\n\nこのままアップロードしますか？（OK＝続行／キャンセル＝中止）`); if (!goOn2) throw new Error('アップロードを中止しました。被写体を中央にした画像を選んでください。'); } } } const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`; const { error } = await db.storage.from('portfolio-media').upload(safeName, file, { upsert: false }); if (error) throw error; return db.storage.from('portfolio-media').getPublicUrl(safeName).data.publicUrl; }
async function saveFaq(event) { event.preventDefault(); const form = event.currentTarget; try { const values = toObject(form); const payload = { question: values.question, answer: values.answer, sort_order: Number(values.sort_order || 0), category: (values.category || '').trim() }; if (values.id) payload.id = values.id; let { error } = await db.from('faqs').upsert(payload); if (error && /category/.test(error.message)) { const { category, ...withoutCategory } = payload; ({ error } = await db.from('faqs').upsert(withoutCategory)); if (!error) alert('カテゴリ以外は保存しました。カテゴリも保存するには、supabase/homepage-improvements.sql をSQL Editorで実行してください。'); } if (error) throw error; message(form, '保存しました！'); form.reset(); form.elements.id.value = ''; await loadAll(); } catch (error) { message(form, `保存できませんでした：${error.message}`, true); } }
async function saveSettings(event) { event.preventDefault(); const form = event.currentTarget; try { const values = toObject(form); values.coupon_enabled = form.elements.coupon_enabled.checked ? 'true' : 'false'; values.booking_open = form.elements.booking_open.checked ? 'true' : 'false'; const file = $('#hero-upload').files[0]; if (file) { values.hero_media_url = await upload(file, 1400, 'トップの看板画像', '正方形に近い比率（例：1400×1400px）で、被写体を画像の中央に配置したものがおすすめです。'); values.hero_media_type = file.type.startsWith('video/') ? 'video' : 'image'; form.elements.hero_media_url.value = values.hero_media_url; form.elements.hero_media_type.value = values.hero_media_type; } const rows = Object.entries(values).map(([key, value]) => ({ key, value: key === 'coupon_percent' ? Number(value) : value })); const { error } = await db.from('site_settings').upsert(rows); if (error) throw error; message(form, '保存しました！'); await loadAll(); } catch (error) { message(form, `保存できませんでした：${error.message}`, true); } }
function formPayload(form, isOption = false) { const values = toObject(form); const result = { ...values, sort_order: Number(values.sort_order || 0) }; delete result.upload; delete result.detail_upload; if (!result.id) delete result.id; if (!isOption && form.elements.is_public) result.is_public = form.elements.is_public.checked; if (isOption) { result.active = form.elements.active ? form.elements.active.checked : true; result.high_only = form.elements.high_only ? form.elements.high_only.checked : false; result.price = values.price === '' ? null : Number(values.price); } return result; }
async function saveEntity(event, type) { event.preventDefault(); const form = event.currentTarget; try { const values = formPayload(form, type === 'options'); if (type === 'products') { values.price = values.price === '' || values.price === undefined ? null : Number(values.price); if (form.elements.is_sold) values.is_sold = form.elements.is_sold.checked; } if (type === 'reviews') { values.rating = Number(values.rating || 5); } const coverFile = form.elements.upload?.files[0]; if (coverFile) { values.cover_url = await upload(coverFile, 1000, 'サムネイル画像', '正方形〜少し横長（例：1600×1300px）で、被写体を画像の中央に配置したものがおすすめです。表示エリアからはみ出た部分は自動でトリミングされます。'); form.elements.cover_url.value = values.cover_url; } const detailFile = form.elements.detail_upload?.files[0]; if (detailFile) { values.media_url = await upload(detailFile, 1000, '詳細表示の画像'); values.media_type = detailFile.type.startsWith('video/') ? 'video' : 'image'; form.elements.media_url.value = values.media_url; form.elements.media_type.value = values.media_type; } if (form.elements.cover_url && !values.cover_url) values.cover_url = ''; let { error } = await db.from(type).upsert(values); if (error && type === 'works' && /(plan|motion|options)/.test(error.message)) { const { plan, motion, options, ...withoutNew } = values; ({ error } = await db.from(type).upsert(withoutNew)); if (!error) alert('プラン・可動域・追加オプション以外は保存しました。これらも保存するには、supabase/homepage-improvements.sql をSQL Editorで実行してください。'); } if (error) throw error; message(form, '保存しました！'); form.reset(); form.elements.id.value = ''; if (form.elements.is_public) form.elements.is_public.checked = true; if (form.elements.active) form.elements.active.checked = true; await loadAll(); } catch (error) { message(form, `保存できませんでした：${error.message}`, true); } }
function edit(type, id) { const item = data[type].find((entry) => String(entry.id) === String(id)); if (!item) return; const form = type === 'options' ? $('#option-form') : $(`#${type.slice(0, -1)}-form`); const wrapper = form.closest('details'); if (wrapper) wrapper.open = true; Object.entries(item).forEach(([key, value]) => { const field = form.elements[key]; if (!field) return; if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = value ?? ''; }); form.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
async function deleteItem(type, id) { if (!confirm('この項目を削除しますか？ 公開サイトからも消えます。')) return; const { error } = await db.from(type).delete().eq('id', id); if (error) return alert(`削除できませんでした：${error.message}`); await loadAll(); }
async function savePrice(type, id) { const input = document.querySelector(`[data-price="${type}"][data-id="${id}"]`); const { error } = await db.from(type).update({ price: Number(input.value || 0) }).eq('id', id); if (error) return alert(`保存できませんでした：${error.message}`); await loadAll(); }

$('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const { email, password } = toObject(form); const { error } = await db.auth.signInWithPassword({ email, password }); if (error) { $('#login-error').textContent = 'ログインできませんでした。メールアドレスとパスワードを確認してください。'; return; } showApp(true); });
$('#logout-button').addEventListener('click', async () => { await db.auth.signOut(); showApp(false); $('#login-panel').hidden = false; });
$('#settings-form').addEventListener('submit', saveSettings); $('#fees-form').addEventListener('submit', saveFees); $('#legal-form').addEventListener('submit', saveLegal); $('#addon-form').addEventListener('submit', saveAddon); $('#product-form').addEventListener('submit', (event) => saveEntity(event, 'products')); $('#work-form').addEventListener('submit', (event) => saveEntity(event, 'works')); $('#model-form').addEventListener('submit', (event) => saveEntity(event, 'models')); $('#option-form').addEventListener('submit', (event) => saveEntity(event, 'options')); $('#motion-form').addEventListener('submit', (event) => saveEntity(event, 'motions')); $('#plan-form').addEventListener('submit', (event) => saveEntity(event, 'plans')); $('#review-form').addEventListener('submit', (event) => saveEntity(event, 'reviews')); $('#faq-form').addEventListener('submit', saveFaq);
document.addEventListener('click', (event) => { const editButton = event.target.closest('[data-edit]'); const deleteButton = event.target.closest('[data-delete]'); const priceButton = event.target.closest('[data-save-price]'); const resetButton = event.target.closest('[data-reset]'); if (editButton) edit(editButton.dataset.edit, editButton.dataset.id); if (deleteButton) deleteItem(deleteButton.dataset.delete, deleteButton.dataset.id); if (priceButton) savePrice(priceButton.dataset.savePrice, priceButton.dataset.id); if (resetButton) { const form = $(`#${resetButton.dataset.reset}`); form.reset(); form.elements.id.value = ''; } });
/* ============================================
   追加機能：依頼フォームのビジュアルビルダー
   （イラスト制作／パーツ分け制作、Googleフォームのような編集体験）
   ============================================ */
const FORM_BUILDER_DEFAULTS = [
  {
    key: 'illustration',
    label: 'イラスト制作',
    description: 'キャラクターデザイン・イラストについてお伺いします',
    intro: 'この度はキャラクターデザインのご依頼をご検討いただき、ありがとうございます🙇🏻‍♀️\n\nできるだけ詳しくご記入いただくことで、イメージに沿ったキャラクターデザインを制作しやすくなります。\n\nまだ決まっていない項目は、空欄のままで大丈夫です。',
    outro: '最後までご回答いただきありがとうございます🙇🏻‍♀️\n\nつきましては、後ほどご回答いただいた内容の確認事項と料金をメッセージにてお送りいたします💬',
    blocks: [
      { type: 'section', title: '基本情報', english: 'BASIC INFORMATION' },
      { type: 'text', label: 'キャラクターのお名前', helper: 'まだ決まっていない場合は、仮のお名前でも大丈夫です。', required: false },
      { type: 'text', label: '実年齢', helper: '', required: false },
      { type: 'single_choice', label: '性別', helper: '', required: false, options: ['女性', '男性', 'その他'] },
      { type: 'section', title: 'キャラクターの雰囲気', english: 'CHARACTER VIBE' },
      { type: 'textarea', label: 'イメージカラー・サブカラー', helper: '', required: false },
      { type: 'textarea', label: '性格・雰囲気', helper: '', required: false }
    ]
  },
  {
    key: 'parts',
    label: 'パーツ分け制作',
    description: '完成イラストのパーツ分けについてお伺いします',
    intro: 'この度はパーツ分けのご依頼をご検討いただき、ありがとうございます🙇🏻‍♀️\n\nイラストデータは、フォーム内からアップロードいただけます。',
    outro: '最後までご回答いただきありがとうございます🙇🏻‍♀️\n\nつきましては、後ほどご回答いただいた内容の確認事項と料金をメッセージにてお送りいたします💬',
    blocks: [
      { type: 'section', title: '基本情報', english: 'BASIC INFORMATION' },
      { type: 'text', label: 'キャラクターのお名前', helper: '', required: false },
      { type: 'single_choice', label: 'ご希望の可動域', helper: '', required: false, options: ['低可動域', '高可動域', 'おまかせ'] },
      { type: 'section', title: 'パーツ分けの詳細', english: 'PARTS DETAIL' },
      { type: 'multi_choice', label: '揺れ物・小物はありますか？', helper: '当てはまるものをすべて選んでください。', required: false, options: ['髪', '衣装', 'アクセサリー', 'その他'] },
      { type: 'textarea', label: '特殊な動き・ご要望', helper: '', required: false }
    ]
  }
];

let requestForms = null;
let activeFormKey = null;

function fbUid() { return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }
function fbFormKey() { return `form${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

function hydrateForm(form) {
  return {
    key: form.key,
    label: form.label || '',
    description: form.description || '',
    intro: form.intro || '',
    outro: form.outro || '',
    blocks: (form.blocks || []).map((block) => ({ ...block, uid: fbUid(), options: block.options ? [...block.options] : [] }))
  };
}

async function loadRequestForms() {
  const { data: row } = await db.from('site_settings').select('value').eq('key', 'request_forms').maybeSingle();
  let parsed = null;
  if (row?.value) { try { parsed = JSON.parse(row.value); } catch (error) { parsed = null; } }
  if (Array.isArray(parsed) && parsed.length) {
    requestForms = parsed.map(hydrateForm);
    activeFormKey = requestForms[0].key;
    return;
  }
  // 旧形式（イラスト・パーツ分けの2つ固定）からの自動移行
  const { data: oldRows } = await db.from('site_settings').select('key,value').in('key', ['illustration_form_config', 'parts_form_config']);
  const oldMap = Object.fromEntries((oldRows || []).map((r) => [r.key, r.value]));
  const migrated = [];
  [['illustration_form_config', FORM_BUILDER_DEFAULTS[0]], ['parts_form_config', FORM_BUILDER_DEFAULTS[1]]].forEach(([oldKey, base]) => {
    if (!oldMap[oldKey]) return;
    try {
      const p = JSON.parse(oldMap[oldKey]);
      migrated.push({ key: base.key, label: base.label, description: base.description, intro: p.intro || base.intro, outro: p.outro || base.outro, blocks: Array.isArray(p.blocks) && p.blocks.length ? p.blocks : base.blocks });
    } catch (error) { /* 無視して既定を使う */ }
  });
  requestForms = (migrated.length ? migrated : FORM_BUILDER_DEFAULTS).map(hydrateForm);
  activeFormKey = requestForms[0]?.key || null;
}

function currentForm() { return requestForms?.find((form) => form.key === activeFormKey) || null; }

function fbEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const FB_TYPE_LABELS = { text: '一行テキスト', textarea: '複数行テキスト', single_choice: '単一選択（1つだけ選べる）', multi_choice: '複数選択（いくつでも選べる）', image: '画像アップロード' };

function renderFormBuilderBlock(block, index, total) {
  const moveUp = index > 0 ? `<button type="button" data-fb-move="${block.uid}:-1" title="上に移動">↑</button>` : `<button type="button" disabled>↑</button>`;
  const moveDown = index < total - 1 ? `<button type="button" data-fb-move="${block.uid}:1" title="下に移動">↓</button>` : `<button type="button" disabled>↓</button>`;
  const controls = `<div class="fb-block-controls">${moveUp}${moveDown}<button type="button" class="fb-remove" data-fb-remove="${block.uid}" title="削除">削除</button></div>`;

  if (block.type === 'section') {
    return `<div class="fb-block fb-block-section">${controls}
      <div class="fb-section-fields">
        <input data-fb-field="${block.uid}:title" value="${fbEscape(block.title)}" placeholder="セクション名（例：基本情報）" />
        <input data-fb-field="${block.uid}:english" value="${fbEscape(block.english)}" placeholder="英語の小見出し（例：BASIC INFORMATION）任意" />
      </div>
    </div>`;
  }

  const typeOptions = Object.entries(FB_TYPE_LABELS).map(([val, label]) => `<option value="${val}" ${block.type === val ? 'selected' : ''}>${label}</option>`).join('');
  const needsOptions = block.type === 'single_choice' || block.type === 'multi_choice';
  const optionsHtml = needsOptions ? `<div class="fb-options">
      <span class="fb-options-label">選択肢</span>
      ${block.options.map((opt, oi) => `<div class="fb-option-row"><input data-fb-option="${block.uid}:${oi}" value="${fbEscape(opt)}" placeholder="選択肢${oi + 1}" /><button type="button" data-fb-option-remove="${block.uid}:${oi}">×</button></div>`).join('')}
      <button type="button" data-fb-option-add="${block.uid}" class="od-mini-button is-ghost">＋ 選択肢を追加</button>
    </div>` : '';

  return `<div class="fb-block fb-block-question">${controls}
    <label class="fb-q-label">質問文<input data-fb-field="${block.uid}:label" value="${fbEscape(block.label)}" placeholder="質問文を入力" /></label>
    <div class="fb-row-2">
      <label>回答の種類<select data-fb-field="${block.uid}:type">${typeOptions}</select></label>
      <label class="fb-required-toggle"><input type="checkbox" data-fb-field="${block.uid}:required" ${block.required ? 'checked' : ''} /><span>必須回答にする</span></label>
    </div>
    <label>補足説明（任意）<input data-fb-field="${block.uid}:helper" value="${fbEscape(block.helper)}" placeholder="補足の説明文（無くてもOK）" /></label>
    ${optionsHtml}
  </div>`;
}

function renderFormBuilder() {
  const state = currentForm();
  $('#fb-kind-tabs').innerHTML = (requestForms || []).map((form) => `<button type="button" class="fb-kind-tab ${form.key === activeFormKey ? 'is-active' : ''}" data-fb-kind="${form.key}">${fbEscape(form.label || '（名前未設定）')}</button>`).join('') || '<p class="empty-text">フォームがありません。「＋ 新しいフォームを追加」から作成してください。</p>';
  if (!state) { $('#fb-blocks').innerHTML = ''; $('#fb-intro').value = ''; $('#fb-outro').value = ''; $('#fb-label').value = ''; $('#fb-description').value = ''; return; }
  $('#fb-label').value = state.label;
  $('#fb-description').value = state.description;
  $('#fb-intro').value = state.intro;
  $('#fb-outro').value = state.outro;
  $('#fb-blocks').innerHTML = state.blocks.map((block, index) => renderFormBuilderBlock(block, index, state.blocks.length)).join('') || '<p class="empty-text">まだ質問がありません。「＋ 質問を追加」から作成できます。</p>';
  $('#fb-message').textContent = '';
}

function findFbBlock(uid) { return currentForm()?.blocks.find((block) => block.uid === uid); }

async function initFormBuilder() {
  if (!db) return;
  document.addEventListener('click', async (event) => {
    const kindTab = event.target.closest('[data-fb-kind]');
    if (kindTab) {
      // 未保存の入力を state に反映してから切り替える（意図せず消えないように）
      syncFormBuilderFieldsToState();
      activeFormKey = kindTab.dataset.fbKind;
      renderFormBuilder();
      return;
    }
    if (event.target.id === 'fb-add-form') {
      syncFormBuilderFieldsToState();
      const label = prompt('新しいフォームの名前を入力してください（例：ボイス収録の依頼）');
      if (!label || !label.trim()) return;
      const newForm = { key: fbFormKey(), label: label.trim(), description: '', intro: '', outro: '', blocks: [] };
      requestForms.push(newForm);
      activeFormKey = newForm.key;
      renderFormBuilder();
      return;
    }
    if (event.target.id === 'fb-delete-form') {
      const state = currentForm();
      if (!state) return;
      if (requestForms.length <= 1) { alert('フォームは最低1つ必要なため、これ以上削除できません。'); return; }
      if (!confirm(`「${state.label || '（名前未設定）'}」を削除します。よろしいですか？\n（すでに届いている回答は消えず、そのまま見られます）`)) return;
      requestForms = requestForms.filter((form) => form.key !== activeFormKey);
      activeFormKey = requestForms[0].key;
      renderFormBuilder();
      saveFormBuilder();
      return;
    }
    if (event.target.id === 'fb-add-question') {
      syncFormBuilderFieldsToState();
      currentForm().blocks.push({ uid: fbUid(), type: 'text', label: '', helper: '', required: false, options: [] });
      renderFormBuilder();
      return;
    }
    if (event.target.id === 'fb-add-section') {
      syncFormBuilderFieldsToState();
      currentForm().blocks.push({ uid: fbUid(), type: 'section', title: '', english: '' });
      renderFormBuilder();
      return;
    }
    const removeButton = event.target.closest('[data-fb-remove]');
    if (removeButton) {
      syncFormBuilderFieldsToState();
      const state = currentForm();
      state.blocks = state.blocks.filter((block) => block.uid !== removeButton.dataset.fbRemove);
      renderFormBuilder();
      return;
    }
    const moveButton = event.target.closest('[data-fb-move]');
    if (moveButton) {
      syncFormBuilderFieldsToState();
      const [uid, dir] = moveButton.dataset.fbMove.split(':');
      const state = currentForm();
      const i = state.blocks.findIndex((block) => block.uid === uid);
      const j = i + Number(dir);
      if (i >= 0 && j >= 0 && j < state.blocks.length) { [state.blocks[i], state.blocks[j]] = [state.blocks[j], state.blocks[i]]; }
      renderFormBuilder();
      return;
    }
    const optionAdd = event.target.closest('[data-fb-option-add]');
    if (optionAdd) {
      syncFormBuilderFieldsToState();
      const block = findFbBlock(optionAdd.dataset.fbOptionAdd);
      if (block) block.options.push('');
      renderFormBuilder();
      return;
    }
    const optionRemove = event.target.closest('[data-fb-option-remove]');
    if (optionRemove) {
      syncFormBuilderFieldsToState();
      const [uid, oi] = optionRemove.dataset.fbOptionRemove.split(':');
      const block = findFbBlock(uid);
      if (block) block.options.splice(Number(oi), 1);
      renderFormBuilder();
      return;
    }
    if (event.target.id === 'fb-save') { saveFormBuilder(); return; }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-fb-field]') && event.target.type === 'checkbox') {
      const [uid] = event.target.dataset.fbField.split(':');
      const block = findFbBlock(uid);
      if (block) block.required = event.target.checked;
    }
    if (event.target.matches('[data-fb-field]') && event.target.tagName === 'SELECT') {
      syncFormBuilderFieldsToState();
      const [uid] = event.target.dataset.fbField.split(':');
      const block = findFbBlock(uid);
      if (block) { block.type = event.target.value; if ((block.type === 'single_choice' || block.type === 'multi_choice') && !block.options.length) block.options = ['']; renderFormBuilder(); }
    }
  });

  await loadRequestForms();
  renderFormBuilder();
}

// 直接DOMに入力された内容（テキスト欄）を、再描画の前に state へ書き戻す
function syncFormBuilderFieldsToState() {
  const state = currentForm();
  if (!state) return;
  state.label = $('#fb-label')?.value ?? state.label;
  state.description = $('#fb-description')?.value ?? state.description;
  state.intro = $('#fb-intro')?.value ?? state.intro;
  state.outro = $('#fb-outro')?.value ?? state.outro;
  document.querySelectorAll('[data-fb-field]').forEach((el) => {
    const [uid, field] = el.dataset.fbField.split(':');
    const block = findFbBlock(uid);
    if (!block) return;
    if (el.type === 'checkbox') block.required = el.checked;
    else if (field === 'type') { /* type は change イベントで即時反映済み */ }
    else block[field] = el.value;
  });
  document.querySelectorAll('[data-fb-option]').forEach((el) => {
    const [uid, oi] = el.dataset.fbOption.split(':');
    const block = findFbBlock(uid);
    if (block) block.options[Number(oi)] = el.value;
  });
}

async function saveFormBuilder() {
  syncFormBuilderFieldsToState();
  const payload = requestForms.map(({ key, label, description, intro, outro, blocks }) => ({
    key, label, description, intro, outro,
    blocks: blocks.map(({ uid, ...rest }) => rest)
  }));
  try {
    const { error } = await db.from('site_settings').upsert({ key: 'request_forms', value: JSON.stringify(payload) });
    if (error) throw error;
    $('#fb-message').textContent = '保存しました！';
    $('#fb-message').style.color = '#579578';
  } catch (error) {
    $('#fb-message').textContent = `保存できませんでした：${error.message}`;
    $('#fb-message').style.color = '#c14978';
  }
}


/* ============================================================
   追加機能：モデル紹介・販売中モデルの「詳細ページ」編集
   （タグ・制作内容の表・動きのサブ画像・表情の変化・こだわりポイント）
   ============================================================ */
const DE_DEFAULT_SPEC_LABELS = ['制作内容', 'プラン', '可動域', 'イラスト', 'パーツ分け', '表情', 'その他'];
const DE_DEFAULT_EXPRESSIONS = ['通常', '笑顔', '照れ', '怒り', '驚き'];
const DE_SPEC_PLACEHOLDERS = { '制作内容': '例：Live2Dモデリング', 'プラン': '例：プチプラン（上半身）', '可動域': '例：低可動域', 'イラスト': '例：きのぴー。制作（オリジナル）', 'パーツ分け': '例：あり', '表情': '例：追加3種類（通常・照れ・驚き）', 'その他': '例：髪・リボン・衣装の揺れ / 呼吸 / 目・口の動き' };
let deState = null;

function deEsc(value) { return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }

function deNormalize(detail) {
  const d = detail && typeof detail === 'object' ? detail : {};
  return {
    tags: Array.isArray(d.tags) ? d.tags.slice() : [],
    specs: Array.isArray(d.specs) && d.specs.length ? d.specs.map((r) => ({ label: r.label || '', value: r.value || '' })) : DE_DEFAULT_SPEC_LABELS.map((label) => ({ label, value: '' })),
    motion_images: (Array.isArray(d.motion_images) ? d.motion_images : []).map((image) => ({ image })),
    expressions: Array.isArray(d.expressions) && d.expressions.length ? d.expressions.map((r) => ({ label: r.label || '', image: r.image || '' })) : DE_DEFAULT_EXPRESSIONS.map((label) => ({ label, image: '' })),
    points: Array.isArray(d.points) ? d.points.map((r) => ({ title: r.title || '', text: r.text || '', image: r.image || '' })) : []
  };
}

function deRowHtml(list, index, row) {
  const imageBlock = (row.image !== undefined) ? `<input data-de-field="image" placeholder="画像URL（右のボタンでアップロードすると自動で入ります）" value="${deEsc(row.image)}" /><label class="de-upload">画像を選ぶ<input type="file" accept="image/*" data-de-upload hidden /></label><span class="de-thumb">${row.image ? `<img src="${deEsc(row.image)}" alt="" />` : ''}</span>` : '';
  let fields = '';
  if (list === 'specs') fields = `<input data-de-field="label" placeholder="項目（例：プラン）" value="${deEsc(row.label)}" /><input data-de-field="value" placeholder="${deEsc(DE_SPEC_PLACEHOLDERS[row.label] || '内容（きのぴー。が担当したこと・仕様など）')}" value="${deEsc(row.value)}" />`;
  if (list === 'expressions') fields = `<input data-de-field="label" placeholder="ラベル（例：笑顔）" value="${deEsc(row.label)}" />`;
  if (list === 'points') fields = `<input data-de-field="title" placeholder="タイトル（例：表情のこだわり）" value="${deEsc(row.title)}" /><textarea data-de-field="text" rows="2" placeholder="説明">${deEsc(row.text)}</textarea>`;
  return `<div class="de-row de-row-${list}" data-de-row="${list}">${fields}${imageBlock}<button type="button" class="de-remove" data-de-remove="${list}:${index}" title="この行を削除">×</button></div>`;
}

function deRender() {
  const d = deState.detail;
  const section = (list, title, hint, addLabel) => `<section class="de-section"><h3>${title}</h3><p class="de-hint">${hint}</p><div class="de-rows">${d[list].map((row, i) => deRowHtml(list, i, row)).join('')}</div><button type="button" class="od-mini-button is-ghost" data-de-add="${list}">＋ ${addLabel}</button></section>`;
  $('#de-body').innerHTML = `
    <section class="de-section"><h3>タグ</h3><p class="de-hint">モデル名の下に表示される小さなラベルです。「、」または「,」で区切って入力してください。</p><input id="de-tags" placeholder="例：オリジナル、Live2Dモデリング、低可動域、表情追加" value="${deEsc(d.tags.join('、'))}" /></section>
    ${section('specs', '制作内容の表（きのぴー。が何をやったか）', 'お客様が「こういうのがいいな」と選ぶときの目安になります。「項目」と「内容」の両方が入っている行だけ表示されます。なお、モデルの「編集」に入力した「担当したこと」は、この表の一番上に自動で表示されます。', '行を追加')}
    ${section('motion_images', '動きのサブ画像', '「実際に動かすとこんな感じ！」の横に並ぶ小さな画像です（2枚くらいがおすすめ）。大きな動画・画像は、モデルの「編集」で登録した詳細画像・動画が使われます。', '画像を追加')}
    ${section('expressions', '表情の変化（小さな写真を5枚くらい）', '表情の写真とラベルを、小さく並べて表示します。写真を入れた表情だけが表示されます（空欄の行は表示されません）。6枚以上にしたい場合は「表情を追加」を押してください。', '表情を追加')}
    ${section('points', 'こだわりポイント', '画像・タイトル・説明を1セットにして、番号つきで表示します。', 'ポイントを追加')}`;
}

function deSync() {
  if (!deState || !$('#de-body')) return;
  const d = deState.detail;
  d.tags = ($('#de-tags')?.value || '').split(/[、,]/).map((t) => t.trim()).filter(Boolean);
  ['specs', 'expressions', 'points', 'motion_images'].forEach((list) => {
    d[list] = [...document.querySelectorAll(`#de-body [data-de-row="${list}"]`)].map((row) => {
      const out = {};
      row.querySelectorAll('[data-de-field]').forEach((input) => { out[input.dataset.deField] = input.value; });
      return out;
    });
  });
}

function deClean() {
  const d = deState.detail;
  const clean = {
    tags: d.tags,
    specs: d.specs.map((r) => ({ label: r.label.trim(), value: r.value.trim() })).filter((r) => r.label && r.value),
    motion_images: d.motion_images.map((r) => (r.image || '').trim()).filter(Boolean),
    expressions: d.expressions.map((r) => ({ label: r.label.trim(), image: r.image.trim() })).filter((r) => r.image),
    points: d.points.map((r) => ({ title: r.title.trim(), text: r.text.trim(), image: r.image.trim() })).filter((r) => r.title || r.text || r.image)
  };
  const empty = !clean.tags.length && !clean.specs.length && !clean.motion_images.length && !clean.expressions.length && !clean.points.length;
  return empty ? null : clean;
}

function openDetailEditor(type, id) {
  const item = (data[type] || []).find((entry) => String(entry.id) === String(id));
  if (!item) return;
  deState = { type, id: item.id, detail: deNormalize(item.detail) };
  $('#de-title').textContent = `「${item.name || item.title}」の詳細ページ`;
  $('#de-message').textContent = '';
  deRender();
  $('#detail-editor-dialog').showModal();
}

async function saveDetailEditor() {
  deSync();
  const message = $('#de-message');
  message.style.color = '#c14978';
  message.textContent = '保存中…';
  const { error } = await db.from(deState.type).update({ detail: deClean() }).eq('id', deState.id);
  if (error) {
    message.textContent = /detail/.test(error.message) ? '保存できませんでした：supabase/model-detail.sql をSupabaseのSQL Editorで実行してください。' : `保存できませんでした：${error.message}`;
    return;
  }
  message.style.color = '#579578';
  message.textContent = '保存しました！';
  showToast('詳細ページを保存しました！');
  await loadAll();
}

document.addEventListener('click', async (event) => {
  const openBtn = event.target.closest('[data-detail-edit]');
  if (openBtn) { openDetailEditor(openBtn.dataset.detailEdit, openBtn.dataset.id); return; }
  const formOpenBtn = event.target.closest('[data-form-detail-edit]');
  if (formOpenBtn) {
    const type = formOpenBtn.dataset.formDetailEdit;
    const form = formOpenBtn.closest('form');
    const id = form?.elements.id?.value;
    if (!id) { alert('先に「保存」を押して登録してから、詳細ページを編集できます。'); return; }
    openDetailEditor(type, id);
    return;
  }
  if (!deState || !event.target.closest('#detail-editor-dialog')) return;
  if (event.target.closest('.detail-editor-close')) { $('#detail-editor-dialog').close(); return; }
  if (event.target.closest('#de-save')) { saveDetailEditor(); return; }
  const addBtn = event.target.closest('[data-de-add]');
  if (addBtn) {
    deSync();
    const list = addBtn.dataset.deAdd;
    const blank = { specs: { label: '', value: '' }, motion_images: { image: '' }, expressions: { label: '', image: '' }, points: { title: '', text: '', image: '' } }[list];
    deState.detail[list].push({ ...blank });
    deRender();
    return;
  }
  const removeBtn = event.target.closest('[data-de-remove]');
  if (removeBtn) {
    deSync();
    const [list, index] = removeBtn.dataset.deRemove.split(':');
    deState.detail[list].splice(Number(index), 1);
    deRender();
  }
});

document.addEventListener('change', async (event) => {
  if (!deState || !event.target.matches('[data-de-upload]')) return;
  const file = event.target.files[0];
  if (!file) return;
  const row = event.target.closest('.de-row');
  const message = $('#de-message');
  try {
    message.style.color = '#c14978';
    message.textContent = '画像をアップロード中…';
    const url = await upload(file, 0, '詳細ページの画像');
    row.querySelector('[data-de-field="image"]').value = url;
    row.querySelector('.de-thumb').innerHTML = `<img src="${deEsc(url)}" alt="" />`;
    // 保存用データにも反映しておく（この後に行を追加・削除して再描画されても、アップロードした画像が消えないように）
    const listName = row.dataset.deRow;
    const rowIndex = [...row.parentElement.children].indexOf(row);
    if (deState.detail[listName]?.[rowIndex]) deState.detail[listName][rowIndex].image = url;
    message.textContent = 'アップロードしました。忘れずに「保存」を押してください。';
    message.style.color = '#579578';
  } catch (error) {
    message.style.color = '#c14978';
    message.textContent = `アップロードできませんでした：${error.message}`;
  }
  event.target.value = '';
});

/* ===== 追加機能：サイドナビのハイライト＆折りたたみを開いてからジャンプ ===== */
function setupSidebarNav() {
  const links = [...document.querySelectorAll('.admin-sidebar a[data-nav]')];
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      const details = target.tagName === 'DETAILS' ? target : target.closest('details');
      if (details && !details.open) details.open = true;
      requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    });
  });
  const sections = links.map((link) => document.getElementById(link.dataset.nav)).filter(Boolean);
  if (!sections.length || !window.IntersectionObserver) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const link = document.querySelector(`.admin-sidebar a[data-nav="${entry.target.id}"]`);
      if (!link) return;
      links.forEach((a) => a.classList.remove('is-active'));
      link.classList.add('is-active');
    });
  }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 });
  sections.forEach((section) => observer.observe(section));
}

/* ===== 追加機能：一覧の検索・絞り込み ===== */
function setupListFilters() {
  document.querySelectorAll('.list-search').forEach((input) => {
    input.addEventListener('input', () => {
      const target = document.getElementById(input.dataset.filterTarget);
      if (!target) return;
      const term = input.value.trim().toLowerCase();
      target.querySelectorAll('.admin-card').forEach((card) => {
        card.style.display = (!term || card.textContent.toLowerCase().includes(term)) ? '' : 'none';
      });
    });
  });
}

setupSidebarNav();
setupListFilters();
initFormBuilder();
checkAuth();
