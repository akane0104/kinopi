const fallbackData = {
  settings: { coupon_percent: 30, coupon_enabled: true, coupon_label: '今なら誰でも使えるクーポンあり！', contact_email: 'hello@example.com', hero_title: 'ぴのきー。へようこそ！', hero_subtitle: 'ここにあなたの看板モデルを掲載できます', hero_media_url: '', hero_media_type: 'image', illustration_price_min: 30000, illustration_price_max: 50000, chardesign_enabled: true, chardesign_price_min: 10000, chardesign_price_max: 30000, illustration_label: 'イラスト制作', chardesign_label: 'キャラクターデザイン', illustration_toggle_text: 'イラスト制作をお願いしたい', chardesign_toggle_text: 'キャラクターデザインをお願いしたい', illustration_desc: '', chardesign_desc: '', parts_ready_label: 'パーツ分け済みイラスト', parts_ready_toggle_text: 'パーツ分けされたイラストがあります', parts_ready_desc: '', booking_open: true, booking_closed_note: 'ただいま新規のご依頼受付をお休みしています。再開まで少々お待ちください。', discord_webhook_url: '', discord_notify_enabled: true, contact_note_x: '', contact_note_discord: '',
  addon_customization_text: `・Live2Dモデルに衣装を追加したい
・既存モデルの髪型を変更したい
・髪色や目の色を変更したい
・表情やポーズを追加したい
・既存イラストから配信素材を作りたい
・今あるイラストをLive2D用にパーツ分けしたい
・以前制作したモデルに新しい要素を追加したい

など、既存のイラストやLive2Dモデルへの追加制作も承ります。

「こんなの作れる？」というご相談もお気軽にどうぞ。` },
  plans: [{ id: 'petit', name: 'プチプラン', price: 20000, description: '上半身の制作' }, { id: 'standard', name: 'スタンダードプラン', price: 40000, description: '全身の制作' }],
  motions: [{ id: 'low', name: '低可動域', price: 30000, description: '基本の動きで、気軽に配信をはじめたい方へ' }, { id: 'high', name: '高可動域', price: 50000, description: '大きく動かして表現を楽しみたい方へ' }],
  options: [
    { id: 'tongue', name: '舌出し', description: '高可動域のみ追加可能', price: null, high_only: true },
    { id: 'profile', name: '横顔まで制作', description: '高可動域のみ追加可能', price: null, high_only: true },
    { id: 'motion', name: '特殊モーション', description: 'あいさつ・ポーズなど', price: null, high_only: false },
    { id: 'item', name: '特別アイテム', description: '小物の表示・切り替えなど', price: null, high_only: false },
    { id: 'chibi', name: 'ミニキャラに変身', description: 'かわいいミニ姿へチェンジ', price: null, high_only: false }
  ],
  faqs: [{ id: 'faq-1', question: 'どれくらいの期間で完成しますか？', answer: 'イラストの込み具合や可動域によって変わりますが、ご相談からお渡しまで標準で1〜2ヶ月ほどです。納期のご希望があればお気軽にお伝えください。' }],
  products: [],
  works: [
    { id: 'sample-work-1', title: 'あなたの実績をここに', category: 'Live2D Modeling', year: '2026', cover_url: '', media_url: '', media_type: 'image', credit: '担当：モデリング / 物理演算', description: '管理画面から画像や動画、担当した内容、制作へのこだわりを登録できます。' },
    { id: 'sample-work-2', title: 'かわいいを動かす', category: 'Character Design', year: '2026', cover_url: '', media_url: '', media_type: 'image', credit: '担当：キャラクターデザイン', description: 'ご依頼の実績が増えたら、ここに作品を追加していきましょう。' },
    { id: 'sample-work-3', title: 'Live2D Showcase', category: 'Illustration & Rigging', year: '2026', cover_url: '', media_url: '', media_type: 'image', credit: '担当：イラスト / パーツ分け / モデリング', description: '動画も登録でき、クリックすると詳しい内容を見せられます。' }
  ],
  models: [{ id: 'sample-model-1', name: 'ぴのきー。model', subtitle: 'your lovely model', cover_url: '', media_url: '', media_type: 'image', description: 'あなたが制作したモデルを、ここでかわいく紹介できます。', credit: 'モデル制作：ぴのきー。' }],
  reviews: []
};

let appData = structuredClone(fallbackData);
const isConfigured = Boolean(window.PINOKII_SUPABASE?.url && window.PINOKII_SUPABASE?.anonKey);
const db = isConfigured && window.supabase ? window.supabase.createClient(window.PINOKII_SUPABASE.url, window.PINOKII_SUPABASE.anonKey) : null;
const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;

async function loadData() {
  if (!db) return;
  const [settings, plans, motions, options, works, models, faqs, products, reviews] = await Promise.all([
    db.from('site_settings').select('key,value'), db.from('plans').select('*').order('sort_order'), db.from('motions').select('*').order('sort_order'),
    db.from('options').select('*').eq('active', true).order('sort_order'), db.from('works').select('*').eq('is_public', true).order('sort_order'), db.from('models').select('*').eq('is_public', true).order('sort_order'),
    db.from('faqs').select('*').order('sort_order'), db.from('products').select('*').eq('is_public', true).order('sort_order'),
    db.from('reviews').select('*').eq('is_public', true).order('sort_order')
  ]);
  if (settings.data) appData.settings = { ...appData.settings, ...Object.fromEntries(settings.data.map((item) => [item.key, item.value])) };
  ['plans', 'motions', 'options', 'works', 'models', 'faqs'].forEach((name, index) => { const data = [plans, motions, options, works, models, faqs][index].data; if (data?.length) appData[name] = data; });
  if (products.data) appData.products = products.data;
  appData.reviews = reviews.data || [];
}

function isBookingOpen() { return String(appData.settings.booking_open ?? true) !== 'false'; }

function applyBookingState() {
  const open = isBookingOpen();
  const note = document.getElementById('booking-note');
  if (note) {
    note.hidden = open;
    if (!open) note.textContent = `♡ ${appData.settings.booking_closed_note || 'ただいま新規のご依頼受付をお休みしています。'}`;
  }
  const consultButton = document.getElementById('consult-button');
  if (consultButton) {
    if (!consultButton.dataset.originalText) consultButton.dataset.originalText = consultButton.innerHTML;
    consultButton.disabled = !open;
    consultButton.classList.toggle('is-disabled', !open);
    consultButton.innerHTML = open ? consultButton.dataset.originalText : '受付をお休み中です';
  }
  const headerContact = document.getElementById('header-contact-button');
  if (headerContact) headerContact.classList.toggle('is-disabled', !open);
}

function hoverVideoUrl(item) { const url = item.media_url || ''; return url && (item.media_type === 'video' || isVideoSource(url)) ? url : ''; }
function isVideoSource(url) { return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url || ''); }
function mediaMarkup(item, className = '') {
  const source = item.cover_url || item.media_url;
  if (!source) return `<div class="${className} placeholder-art"><span>✦<br />NEW<br />WORK</span></div>`;
  const isVideo = item.cover_url ? isVideoSource(item.cover_url) : item.media_type === 'video';
  return isVideo ? `<video class="${className}" src="${source}" muted loop playsinline preload="metadata"></video>` : `<img class="${className}" src="${source}" alt="${item.title || item.name || ''}" loading="lazy" />`;
}

function setHero() {
  const s = appData.settings;
  const couponOn = String(s.coupon_enabled ?? true) !== 'false';
  const banner = document.getElementById('coupon-banner');
  if (banner) banner.style.display = couponOn ? '' : 'none';
  document.getElementById('coupon-label').textContent = s.coupon_label;
  document.getElementById('coupon-percent').textContent = s.coupon_percent || 30;
  document.getElementById('discount-rate').textContent = s.coupon_percent || 30;
  document.getElementById('hero-title').textContent = s.hero_title;
  document.getElementById('hero-subtitle').textContent = s.hero_subtitle;
  // お問い合わせ先：実際に案内している方法（相談フォーム・X・Discord）を表示。仮のメールアドレスは表示しない
  const xUrl = (s.contact_x_url || 'https://x.com/Qinopy0104').trim();
  const discordId = (s.contact_discord_id || 'kinopi_0104').trim();
  const xLink = document.getElementById('contact-x-link');
  if (xLink) xLink.href = xUrl;
  const footerX = document.getElementById('footer-x-link');
  if (footerX) footerX.href = xUrl;
  const discordEl = document.getElementById('contact-discord');
  if (discordEl) discordEl.textContent = `Discord：${discordId}`;
  const mailEl = document.getElementById('contact-email');
  const mail = String(s.contact_email || '').trim();
  if (mailEl) {
    const isPlaceholder = !mail || /@example\.(com|org|net)$/i.test(mail);
    mailEl.hidden = isPlaceholder;
    if (!isPlaceholder) mailEl.href = `mailto:${mail}`;
  }
  const campaignName = document.getElementById('campaign-name');
  if (campaignName) campaignName.textContent = s.coupon_label || '';
  // ファーストビューの料金の目安：登録されているプランの最安値から自動で計算（固定の数字は使わない）
  const heroPrice = document.getElementById('hero-price');
  const planPrices = appData.plans.map((plan) => Number(plan.price)).filter((price) => Number.isFinite(price) && price > 0);
  if (heroPrice) {
    if (planPrices.length) document.getElementById('hero-price-from').textContent = `${Math.min(...planPrices).toLocaleString('ja-JP')}円`;
    else heroPrice.hidden = true;
  }
  const illustLabel = s.illustration_label || 'イラスト制作';
  const chardesLabel = s.chardesign_label || 'キャラクターデザイン';
  ['illustration-legend-text'].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = illustLabel; });
  ['chardesign-legend-text'].forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = chardesLabel; });
  const illustToggleText = document.getElementById('illustration-toggle-text');
  if (illustToggleText) illustToggleText.textContent = s.illustration_toggle_text || `${illustLabel}をお願いしたい`;
  const chardesToggleText = document.getElementById('chardesign-toggle-text');
  if (chardesToggleText) chardesToggleText.textContent = s.chardesign_toggle_text || `${chardesLabel}をお願いしたい`;
  const illustDesc = document.getElementById('illustration-desc');
  if (illustDesc) { illustDesc.textContent = s.illustration_desc || ''; illustDesc.hidden = !s.illustration_desc; }
  const chardesDesc = document.getElementById('chardesign-desc');
  if (chardesDesc) { chardesDesc.textContent = s.chardesign_desc || ''; chardesDesc.hidden = !s.chardesign_desc; }
  const partsReadyLabel = s.parts_ready_label || 'パーツ分け済みイラスト';
  const partsReadyLegend = document.getElementById('parts-ready-legend-text');
  if (partsReadyLegend) partsReadyLegend.textContent = partsReadyLabel;
  const partsReadyToggleText = document.getElementById('parts-ready-toggle-text');
  if (partsReadyToggleText) partsReadyToggleText.textContent = s.parts_ready_toggle_text || 'パーツ分けされたイラストがあります';
  const partsReadyDesc = document.getElementById('parts-ready-desc');
  if (partsReadyDesc) { partsReadyDesc.textContent = s.parts_ready_desc || ''; partsReadyDesc.hidden = !s.parts_ready_desc; }
  applyBookingState();
  const miniCoupon = document.querySelector('.mini-coupon');
  if (miniCoupon) {
    miniCoupon.style.display = couponOn ? '' : 'none';
    const percentEl = miniCoupon.querySelector('em');
    if (percentEl) percentEl.textContent = `${s.coupon_percent}% OFF!`;
  }
  const discountRow = document.querySelector('.estimate-total .discount');
  if (discountRow) discountRow.style.display = couponOn ? '' : 'none';
  const totalBox = document.querySelector('.estimate-total');
  if (totalBox) totalBox.classList.toggle('coupon-active', couponOn);
  const yen2 = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;
  const illustPrice = document.getElementById('illustration-price');
  if (illustPrice) illustPrice.textContent = `${yen2(s.illustration_price_min)}〜${yen2(s.illustration_price_max)}`;
  const chardesFieldset = document.getElementById('chardesign-fieldset');
  if (chardesFieldset) chardesFieldset.style.display = String(s.chardesign_enabled ?? true) !== 'false' ? '' : 'none';
  const chardesPrice = document.getElementById('chardesign-price');
  if (chardesPrice) chardesPrice.textContent = `${yen2(s.chardesign_price_min)}〜${yen2(s.chardesign_price_max)}`;
  const hero = document.getElementById('hero-media');
  if (s.hero_media_url) { hero.classList.remove('placeholder-art'); hero.dataset.placeholder = 'false'; hero.innerHTML = s.hero_media_type === 'video' ? `<video src="${s.hero_media_url}" autoplay muted loop playsinline></video>` : `<img src="${s.hero_media_url}" alt="${s.hero_title}" />`; }
}

function renderWorks() {
  const grid = document.getElementById('works-grid');
  grid.innerHTML = appData.works.map((work, index) => {
    const specs = [work.plan, work.motion, work.options].map((value) => String(value || '').trim()).filter(Boolean);
    return `<button class="work-card work-${index + 1}" data-detail="works" data-id="${work.id}" data-video="${hoverVideoUrl(work)}">${mediaMarkup(work, 'work-media')}<span class="work-copy"><small>${work.category || 'Live2D'}</small><b>${work.title}</b>${specs.length ? `<span class="work-spec">${specs.map((value) => `<i>${value}</i>`).join('')}</span>` : ''}<em>more <i>→</i></em></span></button>`;
  }).join('');
}

function renderModels() {
  const list = document.getElementById('models-list');
  list.innerHTML = appData.models.map((model, index) => `<button class="model-card model-${index + 1}" data-detail="models" data-id="${model.id}" data-video="${hoverVideoUrl(model)}">${mediaMarkup(model, 'model-media')}<span><small>model ${String(index + 1).padStart(2, '0')}</small><b>${model.name}</b><em>${model.subtitle || 'Live2D model'} <i>↗</i></em></span></button>`).join('');
}

function renderProducts() {
  const grid = document.getElementById('products-list');
  if (!grid) return;
  if (!appData.products.length) { grid.innerHTML = '<p class="products-empty">もうすぐ完成モデルが並びます ♡<br />お楽しみに！</p>'; return; }
  grid.innerHTML = appData.products.map((product) => {
    const priceText = product.price === null || product.price === undefined || product.price === '' ? '要お見積り' : yen(product.price);
    return `<article class="product-card">
      <button class="product-media-hit" data-detail="products" data-id="${product.id}" data-video="${hoverVideoUrl(product)}">${mediaMarkup(product, 'product-media')}${product.is_sold ? '<i class="sold-tag">SOLD OUT</i>' : ''}</button>
      <div class="product-copy"><b>${product.name}</b><small>${product.description || ''}</small><strong>${priceText}</strong></div>
      <button class="button bubble product-buy" type="button" data-buy="${product.id}" ${product.is_sold ? 'disabled' : ''}>${product.is_sold ? '販売済みです' : 'この子をお迎えする ♡'} </button>
    </article>`;
  }).join('');
}

function previewButton(type, item) { return item.media_url ? `<button type="button" class="preview-button" data-detail="${type}" data-id="${item.id}">見本を見る <span>→</span></button>` : ''; }

function renderChoices() {
  document.getElementById('plan-choices').innerHTML = appData.plans.map((plan) => `<label class="choice-card"><input type="radio" name="plan" value="${plan.id}" /><span class="choice-top"><b>${plan.name}</b><strong>${yen(plan.price)}<small>〜</small></strong></span><span class="choice-desc">${plan.description}</span></label>`).join('');
  document.getElementById('motion-choices').innerHTML = appData.motions.map((motion) => `<label class="choice-card"><input type="radio" name="motion" value="${motion.id}" /><span class="choice-top"><b>${motion.name}</b><strong>+ ${yen(motion.price)}</strong></span><span class="choice-desc">${motion.description}</span>${previewButton('motions', motion)}</label>`).join('');
  document.getElementById('option-choices').innerHTML = appData.options.map((option) => `<label class="option-card" data-high-only="${option.high_only}"><input type="checkbox" name="options" value="${option.id}" /><span class="check">✓</span><span><b>${option.name}${option.high_only ? '<i class="high-only-badge">高可動域のみ</i>' : ''}</b><small>${option.description || ''}</small></span><em>${option.price === null ? '要お見積り' : `+ ${yen(option.price)}`}</em>${previewButton('options', option)}</label>`).join('');
}

function getSelected(name) { return document.querySelector(`input[name="${name}"]:checked`)?.value; }
function collectEstimate() {
  const plan = appData.plans.find((item) => String(item.id) === getSelected('plan'));
  const motion = appData.motions.find((item) => String(item.id) === getSelected('motion'));
  const chardesignOn = String(appData.settings.chardesign_enabled ?? true) !== 'false';
  const illustChecked = Boolean(document.getElementById('illustration-toggle')?.checked);
  const chardesChecked = chardesignOn && Boolean(document.getElementById('chardesign-toggle')?.checked);
  const partsReadyChecked = Boolean(document.getElementById('parts-ready-toggle')?.checked);
  let hasQuote = false;
  const baseFee = Number(plan?.price || 0) + Number(motion?.price || 0);
  let extraFee = 0;
  let subtotal = baseFee;
  if (illustChecked) { subtotal += Number(appData.settings.illustration_price_min || 0); extraFee += Number(appData.settings.illustration_price_min || 0); }
  if (chardesChecked) { subtotal += Number(appData.settings.chardesign_price_min || 0); extraFee += Number(appData.settings.chardesign_price_min || 0); }
  document.querySelectorAll('input[name="options"]:checked').forEach((input) => { const option = appData.options.find((item) => String(item.id) === input.value); if (option?.price === null) hasQuote = true; else { subtotal += Number(option?.price || 0); extraFee += Number(option?.price || 0); } });
  const selectedOptions = [...document.querySelectorAll('input[name="options"]:checked')].map((el) => appData.options.find((item) => String(item.id) === el.value)?.name).filter(Boolean);
  const couponOn = String(appData.settings.coupon_enabled ?? true) !== 'false';
  const discount = couponOn ? Math.round(subtotal * (Number(appData.settings.coupon_percent || 0) / 100)) : 0;
  return { plan, motion, chardesignOn, illustChecked, chardesChecked, partsReadyChecked, selectedOptions, baseFee, extraFee, subtotal, discount, total: subtotal - discount, hasQuote, hasRange: illustChecked || chardesChecked };
}
function updateEstimate() {
  const est = collectEstimate();
  document.querySelectorAll('[data-high-only="true"]').forEach((card) => { const disabled = String(est.motion?.id) !== 'high'; card.classList.toggle('unavailable', disabled); const input = card.querySelector('input'); input.disabled = disabled; if (disabled) input.checked = false; });
  const baseEl = document.getElementById('est-base');
  const extraEl = document.getElementById('est-extra');
  if (baseEl) baseEl.textContent = yen(est.baseFee);
  if (extraEl) extraEl.textContent = `＋${yen(est.extraFee)}`;
  document.getElementById('subtotal').textContent = yen(est.subtotal);
  document.getElementById('discount').textContent = `−${yen(est.discount)}`;
  document.getElementById('total').textContent = yen(est.total);
  const noticeParts = [];
  if (est.hasRange) noticeParts.push('※イラスト・キャラクターデザインの料金に幅があるため、合計は最安値で計算しています');
  if (est.hasQuote) noticeParts.push('＋ 要お見積りの項目があります');
  document.getElementById('quote-notice').textContent = noticeParts.join('　');
}

function escapeAddonHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function renderAddonText() {
  const container = document.getElementById('addon-text');
  if (!container) return;
  const raw = appData.settings.addon_customization_text || '';
  const lines = raw.split('\n');
  let html = '';
  let listBuffer = [];
  let paraBuffer = [];
  const flushList = () => { if (listBuffer.length) { html += `<ul class="addon-list">${listBuffer.map((item) => `<li>${item}</li>`).join('')}</ul>`; listBuffer = []; } };
  const flushPara = () => { if (paraBuffer.length) { html += `<p>${paraBuffer.join('<br>')}</p>`; paraBuffer = []; } };
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('・')) { flushPara(); listBuffer.push(escapeAddonHtml(trimmed.slice(1))); }
    else if (!trimmed) { flushList(); flushPara(); }
    else { flushList(); paraBuffer.push(escapeAddonHtml(trimmed)); }
  });
  flushList();
  flushPara();
  container.innerHTML = html;
}

let faqCategory = 'all';
function renderFaqs() {
  const list = document.getElementById('faq-list');
  if (!list) return;
  const categories = [...new Set(appData.faqs.map((faq) => String(faq.category || '').trim()).filter(Boolean))];
  const hasUncategorized = appData.faqs.some((faq) => !String(faq.category || '').trim());
  const filters = document.getElementById('faq-filters');
  if (filters) {
    if (faqCategory !== 'all' && faqCategory !== '__none__' && !categories.includes(faqCategory)) faqCategory = 'all';
    // カテゴリが1つも設定されていないときは、絞り込みは表示しない（従来どおりの見た目）
    filters.hidden = categories.length === 0;
    filters.innerHTML = categories.length ? [['all', 'すべて'], ...categories.map((name) => [name, name]), ...(hasUncategorized ? [['__none__', 'その他']] : [])]
      .map(([value, label]) => `<button type="button" class="faq-chip ${faqCategory === value ? 'is-active' : ''}" data-faq-category="${value}">${label}</button>`).join('') : '';
  }
  const visible = appData.faqs.filter((faq) => {
    const category = String(faq.category || '').trim();
    if (faqCategory === 'all') return true;
    if (faqCategory === '__none__') return !category;
    return category === faqCategory;
  });
  list.innerHTML = visible.map((faq) => `<details class="faq-item"><summary>${faq.question}<i>＋</i></summary><p>${faq.answer}</p></details>`).join('');
}

function renderReviews() {
  const section = document.getElementById('reviews');
  const list = document.getElementById('reviews-list');
  if (!list || !section) return;
  if (!appData.reviews.length) { section.hidden = true; return; }
  section.hidden = false;
  list.innerHTML = appData.reviews.map((review) => {
    const rating = Math.max(1, Math.min(5, Number(review.rating) || 5));
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    return `<article class="review-card"><span class="review-stars">${stars}</span><p class="review-comment">${review.comment}</p><b class="review-author">${review.author_name}</b></article>`;
  }).join('');
}

const CONTACT_SETTINGS = {
  email: { note: 'ぴのきー。からの返信はメールでお送りします。', label: 'ご連絡先メールアドレス', placeholder: 'reply@example.com' },
  x: { note: 'X（旧Twitter）は「@Qinopy0104」です。\n\nXでのやり取りをご希望の方は、こちらのアカウントまでお気軽にご連絡ください！', label: 'あなたのXのID（＠込みでもOK）', placeholder: '@your_id' },
  discord: { note: 'Discordでお話ししたい方は、「kinopi_0104」までフレンド申請お願いします！', label: 'あなたのDiscordユーザー名', placeholder: 'your_discord_name' }
};

function updateContactFields() {
  const method = document.getElementById('contact-method').value;
  const settings = CONTACT_SETTINGS[method] || CONTACT_SETTINGS.email;
  const overrides = { x: appData.settings.contact_note_x, discord: appData.settings.contact_note_discord };
  document.getElementById('contact-note').textContent = overrides[method] || settings.note;
  document.getElementById('contact-id-label').firstChild.textContent = settings.label;
  document.getElementById('contact-id-input').placeholder = settings.placeholder;
}

function openInquiry(presetName = '') {
  if (!isBookingOpen()) { applyBookingState(); document.getElementById('booking-note')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const modal = document.getElementById('inquiry-modal');
  const form = document.getElementById('inquiry-form');
  const result = document.getElementById('inquiry-result');
  form.hidden = false;
  result.hidden = true;
  form.reset();
  updateContactFields();
  if (presetName) form.elements.request_name.value = presetName;
  document.getElementById('inquiry-message').textContent = '';
  const est = collectEstimate();
  const rows = [
    ['プラン', est.plan?.name || ''],
    ['可動域', est.motion?.name || ''],
    [appData.settings.illustration_label || 'イラスト制作', est.illustChecked ? 'お願いしたい' : '—'],
    [appData.settings.chardesign_label || 'キャラクターデザイン', est.chardesChecked ? 'おまかせ' : '—'],
    ['追加オプション', est.selectedOptions.join('、') || 'なし'],
    ['お支払い目安', `${yen(est.total)}${est.hasQuote ? ' ＋要お見積り' : ''}`]
  ];
  document.getElementById('inquiry-summary').innerHTML = rows.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('');
  modal.showModal();
}

async function submitInquiry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const messageEl = document.getElementById('inquiry-message');
  if (!db) { messageEl.textContent = '接続エラー：サイトの設定を確認してください。'; messageEl.style.color = '#c14978'; return; }
  const values = Object.fromEntries(new FormData(form).entries());
  const est = collectEstimate();
  const now = new Date();
  const pad = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const serial = `PNK-${pad}-${rand}`;
  const contactMethod = values.contact_method || 'email';
  const payload = { serial, request_name: values.request_name, contact_method: contactMethod, contact_id: values.contact_id || '', email: contactMethod === 'email' ? (values.contact_id || '') : '', message: values.message || '', plan: est.plan?.name || '', motion: est.motion?.name || '', options: est.selectedOptions.join('、'), total: est.total, illustration_needed: est.illustChecked, chardesign_needed: est.chardesChecked, parts_illustration_ready: est.partsReadyChecked };
  let { error } = await db.from('inquiries').insert(payload);
  if (error && /illustration_needed|chardesign_needed|parts_illustration_ready|column/i.test(error.message)) {
    // supabase/request-scope.sql・parts-illustration-ready.sql が未実行の環境でも、他の項目だけは送信できるようにする
    const { illustration_needed, chardesign_needed, parts_illustration_ready, ...fallbackPayload } = payload;
    ({ error } = await db.from('inquiries').insert(fallbackPayload));
  }
  if (error) { messageEl.textContent = `送信できませんでした：${error.message}`; messageEl.style.color = '#c14978'; return; }
  document.getElementById('inquiry-serial').textContent = serial;
  const statusLink = document.getElementById('inquiry-status-link');
  if (statusLink) statusLink.href = `status.html?serial=${encodeURIComponent(serial)}`;
  form.hidden = true;
  document.getElementById('inquiry-result').hidden = false;
  notifyDiscord('new_inquiry', {
    serial, name: values.request_name, plan: est.plan?.name || '', motion: est.motion?.name || '',
    illust: est.illustChecked, chardes: est.chardesChecked, total: est.total, hasQuote: est.hasQuote,
    contactMethod, contactId: values.contact_id || ''
  });
}

/* ===== 追加機能：Discordへの新着通知 ===== */
async function notifyDiscord(kind, data) {
  const s = appData.settings;
  const url = s.discord_webhook_url;
  const enabled = String(s.discord_notify_enabled ?? true) !== 'false';
  if (!url || !enabled) return;
  const methodLabel = { email: 'メール', x: 'X（DM）', discord: 'Discord' }[data.contactMethod] || 'メール';
  const lines = [
    '🎀 新しいご依頼が届きました！',
    `依頼者：${data.name}`,
    `シリアル：${data.serial}`,
    `プラン：${data.plan || '未選択'}／可動域：${data.motion || '未選択'}`,
    `イラスト制作：${data.illust ? '必要' : '不要'}／キャラデザ：${data.chardes ? '必要' : '不要'}`,
    `お見積り：${data.total ? `¥${Number(data.total).toLocaleString('ja-JP')}` : '要お見積り'}${data.hasQuote ? '（＋要お見積り項目あり）' : ''}`,
    `連絡方法：${methodLabel}${data.contactId ? `（${data.contactId}）` : ''}`
  ];
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: lines.join('\n') })
    });
  } catch (error) {
    // 通知が失敗しても、依頼の受付自体は成功しているので何もしない
  }
}

function workSpecList(work) {
  const rows = [['制作内容', work.category], ['プラン', work.plan], ['可動域', work.motion], ['追加オプション', work.options]].filter(([, value]) => String(value || '').trim());
  return rows.length ? `<dl class="modal-spec">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>` : '';
}

const RD_SPEC_ICONS = { '担当したこと': '♡', '制作内容': '⚙', 'プラン': '♛', '可動域': '⤢', 'イラスト': '✎', 'パーツ分け': '✂', '表情': '☺', 'その他': '⋯' };

// モデル紹介・販売中モデルを開いたときの「詳細ページ」
function richDetailHtml(type, item) {
  const esc = escapeAddonHtml;
  const d = item.detail && typeof item.detail === 'object' ? item.detail : {};
  const isProduct = type === 'products';
  const isWork = type === 'works';
  const index = appData[type].findIndex((entry) => String(entry.id) === String(item.id));
  const media = item.media_url || '';
  const mediaIsVideo = item.media_type === 'video' || isVideoSource(media);
  const cover = item.cover_url || (!mediaIsVideo ? media : '');
  const tags = Array.isArray(d.tags) ? d.tags.filter(Boolean) : [];
  const rawSpecs = (Array.isArray(d.specs) ? d.specs : []).filter((row) => row && row.label && row.value);
  // 既存の項目（担当したこと・プラン・可動域・追加オプション）も、制作内容の表の先頭に自動で載せる
  const autoSpecs = [];
  if (item.credit && String(item.credit).trim()) autoSpecs.push({ label: '担当したこと', value: String(item.credit).trim() });
  if (isWork) {
    if (item.plan) autoSpecs.push({ label: 'プラン', value: item.plan });
    if (item.motion) autoSpecs.push({ label: '可動域', value: item.motion });
    if (item.options) autoSpecs.push({ label: '追加オプション', value: item.options });
  }
  const specs = [...autoSpecs.filter((row) => !rawSpecs.some((r) => r.label === row.label)), ...rawSpecs];
  const sub = (Array.isArray(d.motion_images) ? d.motion_images : []).filter(Boolean);
  const expressions = (Array.isArray(d.expressions) ? d.expressions : []).filter((row) => row && row.image);
  const points = (Array.isArray(d.points) ? d.points : []).filter((row) => row && (row.title || row.text || row.image));
  const mainMotion = mediaIsVideo ? `<video src="${esc(media)}" controls playsinline preload="metadata"${cover ? ` poster="${esc(cover)}"` : ''}></video>` : (media && media !== cover ? `<img src="${esc(media)}" alt="" />` : '');
  const hasMotion = Boolean(mainMotion) || sub.length > 0;
  const hasRight = hasMotion || expressions.length > 0 || points.length > 0;
  const name = item.title || item.name || '';
  const priceText = isProduct ? (item.price === null || item.price === undefined || item.price === '' ? '要お見積り' : yen(item.price)) : '';
  const sold = isProduct && item.is_sold;

  const head = isProduct
    ? `<p class="rd-tag">READY TO ADOPT <span>♥</span></p><h2>販売中モデル</h2><p class="rd-sub">すでに完成していて、お迎えできるモデルです。</p>`
    : isWork
    ? `<p class="rd-tag">OUR WORKS <span>✎</span></p><h2>制作実績</h2><p class="rd-sub">お客様のご依頼で制作した作品です。</p>`
    : `<p class="rd-tag">MEET THE MODELS <span>★</span></p><h2>モデル紹介</h2><p class="rd-sub">モデルの動きを、動画や画像で見られるギャラリーです。</p>`;

  const left = `<div class="rd-card rd-model">
      <div class="rd-cover">${cover ? `<img src="${esc(cover)}" alt="${esc(name)}" />` : '<div class="rd-cover-empty">✦</div>'}${sold ? '<i class="sold-tag">SOLD OUT</i>' : ''}</div>
      <div class="rd-model-copy">
        <small>${isProduct ? 'READY-MADE' : isWork ? (item.category || 'WORK') : `MODEL ${String(index + 1).padStart(2, '0')}`}</small>
        <h3>${esc(name)}</h3>
        ${item.subtitle ? `<span class="rd-model-sub">${esc(item.subtitle)}</span>` : ''}
        ${item.staff_name ? `<span class="rd-staff">制作担当：${esc(item.staff_name)}</span>` : ''}
        ${isWork && item.year ? `<span class="rd-model-sub">${esc(item.year)}</span>` : ''}
        ${isProduct ? `<strong class="rd-price">${priceText}</strong>` : ''}
        ${tags.length ? `<div class="rd-tags">${tags.map((tag) => `<i>${esc(tag)}</i>`).join('')}</div>` : ''}
        ${item.description ? `<p class="rd-desc">${esc(item.description)}</p>` : ''}
      </div>
    </div>
    ${specs.length ? `<div class="rd-card rd-specs"><p class="rd-label">WORK DETAILS</p><h4>制作内容</h4><dl>${specs.map((row) => `<div><dt><i>${RD_SPEC_ICONS[row.label] || '✦'}</i>${esc(row.label)}</dt><dd>${esc(row.value)}</dd></div>`).join('')}</dl></div>` : ''}`;

  const right = `${hasMotion ? `<div class="rd-card rd-motion">
      <div class="rd-motion-head"><div><p class="rd-label">LIVE2D MOTION</p><h4>実際に動かすとこんな感じ！</h4></div><span class="rd-bubble">表情の変化や髪・衣装の揺れなど、実際のモデルの動きをご覧いただけます！</span></div>
      <div class="rd-motion-body ${sub.length && mainMotion ? 'has-sub' : ''}">${mainMotion ? `<div class="rd-motion-main">${mainMotion}</div>` : ''}${sub.length ? `<div class="rd-motion-sub">${sub.map((url) => `<img src="${esc(url)}" alt="" />`).join('')}</div>` : ''}</div>
    </div>` : ''}
    ${expressions.length ? `<div class="rd-card rd-expressions"><div class="rd-exp-head"><div><p class="rd-label">EXPRESSION</p><h4>表情の変化</h4></div><span>様々な表情を組み合わせて、豊かな表情が作れます。</span></div><div class="rd-exp-grid">${expressions.map((row) => `<figure>${row.image ? `<img src="${esc(row.image)}" alt="${esc(row.label || '')}" />` : '<div class="rd-exp-empty">✦</div>'}<figcaption>${esc(row.label || '')}</figcaption></figure>`).join('')}</div></div>` : ''}
    ${points.length ? `<div class="rd-card rd-points"><p class="rd-label">POINT <b>こだわったポイント</b> <span>✦</span></p><ol>${points.map((row, i) => `<li>${row.image ? `<img src="${esc(row.image)}" alt="" />` : '<span class="rd-point-noimg">✦</span>'}<div><b><em>${String(i + 1).padStart(2, '0')}</em>${esc(row.title || '')}</b><p>${esc(row.text || '').replace(/\n/g, '<br>')}</p></div></li>`).join('')}</ol></div>` : ''}`;

  const cta = `<div class="rd-cta">
      ${cover ? `<img class="rd-cta-img" src="${esc(cover)}" alt="" />` : ''}
      <span class="rd-cta-bubble">${isProduct ? 'このモデルのお迎えについて、詳しく相談できます♡' : 'このモデルの制作について、詳しく相談できます♡'}</span>
      <button type="button" class="button bubble rd-cta-button" data-rd-consult="${type}:${item.id}" ${sold ? 'disabled' : ''}>${sold ? '販売済みです' : (isProduct ? 'このモデルをお迎えする' : '相談してみる')} <span>${sold ? '' : '→'}</span></button>
    </div>`;

  return `<div class="rd-wrap"><header class="rd-head">${head}</header><div class="rd-layout ${hasRight ? '' : 'is-single'}"><div class="rd-left">${left}</div>${hasRight ? `<div class="rd-right">${right}</div>` : ''}</div>${cta}</div>`;
}

function openDetail(type, id) {
  const item = appData[type].find((entry) => String(entry.id) === String(id));
  if (!item) return;
  const dialog = document.getElementById('detail-modal');
  const isRich = type === 'models' || type === 'products' || type === 'works';
  dialog.classList.toggle('rich-detail', isRich);
  if (isRich) {
    document.getElementById('modal-body').innerHTML = richDetailHtml(type, item);
    dialog.showModal();
    dialog.scrollTop = 0;
    return;
  }
  const media = item.media_url || item.cover_url;
  const isVideo = item.media_type === 'video' || isVideoSource(media);
  const categoryLabel = { motions: '可動域の見本', options: 'オプションの見本' }[type];
  const modal = document.getElementById('detail-modal');
  document.getElementById('modal-body').innerHTML = `${media ? (isVideo ? `<video src="${media}" controls autoplay loop playsinline style="max-height:min(72vh,600px);width:auto;max-width:100%"></video>` : `<img src="${media}" alt="${item.title || item.name}" />`) : '<div class="modal-placeholder">✦</div>'}<div class="modal-copy"><small>${item.category || categoryLabel || 'LIVE2D MODEL'}</small><h2>${item.title || item.name}</h2><p class="modal-credit">${item.credit || ''}</p>${type === 'works' ? workSpecList(item) : ''}<p>${item.description || '詳細は準備中です。'}</p></div>`;
  modal.showModal();
}

function setupDeselectableChoice(containerId, name) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.addEventListener('mousedown', (event) => {
    const card = event.target.closest('.choice-card');
    const radio = card?.querySelector(`input[name="${name}"]`);
    if (radio) radio.dataset.wasChecked = radio.checked ? 'true' : 'false';
  });
  container.addEventListener('click', (event) => {
    const card = event.target.closest('.choice-card');
    const radio = card?.querySelector(`input[name="${name}"]`);
    if (!radio || radio.dataset.wasChecked !== 'true') return;
    radio.checked = false;
    card.classList.remove('selected');
    updateEstimate();
  });
}

function setupInteractions() {
  document.querySelectorAll('.menu-button').forEach((button) => button.addEventListener('click', () => { const isOpen = button.getAttribute('aria-expanded') === 'true'; button.setAttribute('aria-expanded', String(!isOpen)); document.getElementById('main-nav').classList.toggle('open', !isOpen); }));
  document.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => { if (input.type === 'radio') document.querySelectorAll(`input[name="${input.name}"]`).forEach((entry) => entry.closest('label').classList.toggle('selected', entry.checked)); if (input.type === 'checkbox') input.closest('label')?.classList.toggle('selected', input.checked); updateEstimate(); }));
  setupDeselectableChoice('plan-choices', 'plan');
  setupDeselectableChoice('motion-choices', 'motion');
  document.getElementById('consult-button').addEventListener('click', () => openInquiry());
  document.getElementById('addon-consult-button')?.addEventListener('click', () => openInquiry());
  document.getElementById('contact-consult-button')?.addEventListener('click', () => openInquiry());
  document.addEventListener('click', (event) => {
    const consult = event.target.closest('[data-rd-consult]');
    if (!consult) return;
    const [type, id] = consult.dataset.rdConsult.split(':');
    const item = appData[type]?.find((entry) => String(entry.id) === String(id));
    if (!item || (type === 'products' && item.is_sold)) return;
    document.getElementById('detail-modal')?.close();
    const itemName = item.name || item.title || '';
    const presets = { products: `完成モデル：${itemName}のお迎え`, models: `モデル紹介：${itemName}について`, works: `制作実績：${itemName}について` };
    openInquiry(presets[type] || '');
  });
  document.getElementById('faq-filters')?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-faq-category]');
    if (!chip) return;
    faqCategory = chip.dataset.faqCategory;
    renderFaqs();
  });
  document.getElementById('inquiry-form').addEventListener('submit', submitInquiry);
  document.getElementById('contact-method').addEventListener('change', updateContactFields);
  document.addEventListener('click', (event) => { const buy = event.target.closest('[data-buy]'); if (buy) { const product = appData.products.find((entry) => String(entry.id) === String(buy.dataset.buy)); if (product && !product.is_sold) openInquiry(`完成モデル：${product.name}のお迎え`); return; } const button = event.target.closest('[data-detail]'); if (button) { event.preventDefault(); event.stopPropagation(); openDetail(button.dataset.detail, button.dataset.id); return; } if (event.target.closest('.modal-close') || event.target.closest('[data-close-inquiry]')) event.target.closest('dialog')?.close(); });
  ['detail-modal', 'inquiry-modal'].forEach((id) => document.getElementById(id).addEventListener('click', (event) => { if (event.target.id === id) event.currentTarget.close(); }));
}

/* ===== 追加機能：ホームで進捗をその場で確認できるミニウィジェット ===== */
const TRACK_STATUS = {
  received: { label: '受付', cls: 'st-received' },
  prep: { label: '制作準備', cls: 'st-prep' },
  working: { label: '制作中', cls: 'st-working' },
  awaiting: { label: 'クライアント確認待ち', cls: 'st-awaiting' },
  revising: { label: '修正中', cls: 'st-revising' },
  final: { label: '最終確認', cls: 'st-final' },
  delivered: { label: '納品', cls: 'st-delivered' },
  completed: { label: '完了', cls: 'st-completed' },
  cancelled: { label: 'キャンセル', cls: 'st-cancelled' }
};
const TRACK_PROCESS_STATUS = { todo: '未着手', working: '制作中', awaiting: '確認待ち', revising: '修正中', ok: 'OK', payment_wait: '支払い待ち', payment_check: '支払い確認済み', done: '完了' };
const TRACK_BASE_STEP_IDS = ['confirm', 'payment', 'psd', 'modeling', 'vts', 'client', 'revision', 'final', 'deliver'];

function trackStepIds(result) {
  const ids = TRACK_BASE_STEP_IDS.slice();
  if (result.illustration_needed) ids.push('illust');
  if (result.chardesign_needed) ids.push('chardesign');
  (Array.isArray(result.expressions_needed) ? result.expressions_needed : []).forEach((name) => ids.push(`expr:${name}`));
  return ids;
}

function trackFmtDate(dateStr) {
  if (!dateStr) return '未定';
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '未定';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function renderTrackResult(result) {
  const message = document.getElementById('track-message');
  const box = document.getElementById('track-result');
  if (!result) { message.textContent = 'そのシリアルナンバーの依頼が見つかりませんでした。入力内容をご確認ください。'; box.hidden = true; return; }
  message.textContent = '';
  box.hidden = false;
  document.getElementById('track-result-serial').textContent = result.serial;
  document.getElementById('track-result-name').textContent = result.request_name;
  const status = result.cancelled ? 'cancelled' : (TRACK_STATUS[result.order_status] ? result.order_status : 'received');
  const st = TRACK_STATUS[status];
  const badge = document.getElementById('track-result-badge');
  badge.textContent = st.label;
  badge.className = `order-status-badge ${st.cls}`;
  document.getElementById('track-result-created').textContent = result.created_date ? trackFmtDate(result.created_date) : '—';
  document.getElementById('track-result-due').textContent = result.due_date ? trackFmtDate(result.due_date) : '未定';
  const validIds = trackStepIds(result);
  const stepsDone = Array.isArray(result.progress_steps) ? result.progress_steps.filter((id) => validIds.includes(id)).length : 0;
  const stepTotal = validIds.length;
  const percent = stepTotal ? Math.min(Math.round((stepsDone / stepTotal) * 100), 100) : 0;
  document.getElementById('track-result-percent').textContent = `${percent}%`;
  document.getElementById('track-result-count').textContent = `${stepsDone} / ${stepTotal} 完了`;
  document.getElementById('track-result-fill').style.width = `${percent}%`;
  const processes = Array.isArray(result.processes) ? result.processes : [];
  document.getElementById('track-result-processes').innerHTML = processes.length
    ? processes.map((p) => `<div class="track-process-row"><b>${p.name}</b><span>${TRACK_PROCESS_STATUS[p.status] || p.status}</span></div>`).join('')
    : '';
  document.getElementById('track-result-link').href = `status.html?serial=${encodeURIComponent(result.serial)}`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function lookupTrack(serial) {
  const message = document.getElementById('track-message');
  message.style.color = '#c14978';
  if (!db) { message.textContent = '現在この機能は準備中です。しばらくしてから再度お試しください。'; return; }
  message.textContent = '確認中…';
  const { data, error } = await db.rpc('get_order_status', { p_serial: serial.trim() });
  if (error) { message.textContent = `確認できませんでした：${error.message}`; document.getElementById('track-result').hidden = true; return; }
  renderTrackResult(data);
}

function setupTrackWidget() {
  const form = document.getElementById('track-form');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const serial = document.getElementById('track-serial').value.trim();
    if (serial) lookupTrack(serial);
  });
  document.getElementById('track-close')?.addEventListener('click', () => { document.getElementById('track-result').hidden = true; });
}

function attachHoverPreviews() {
  document.querySelectorAll('[data-video]').forEach((card) => {
    const videoUrl = card.dataset.video;
    if (!videoUrl || card.dataset.previewBound === 'true') return;
    card.dataset.previewBound = 'true';
    let timer = null;
    let overlay = null;
    const start = () => { timer = setTimeout(() => {
      if (overlay || !card.isConnected) return;
      overlay = document.createElement('div');
      overlay.className = 'hover-preview';
      overlay.innerHTML = `<video src="${videoUrl}" muted autoplay loop playsinline></video><span class="hover-preview-tag">preview ♡</span>`;
      card.appendChild(overlay);
    }, 700); };
    const stop = () => { clearTimeout(timer); timer = null; if (overlay) { overlay.remove(); overlay = null; } };
    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
  });
}

async function init() { await loadData(); setHero(); renderWorks(); renderModels(); renderProducts(); renderChoices(); renderFaqs(); renderReviews(); renderAddonText(); setupInteractions(); updateEstimate(); attachHoverPreviews(); setupTrackWidget(); }
init();
