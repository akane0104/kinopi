const configured = Boolean(window.PINOKII_SUPABASE?.url && window.PINOKII_SUPABASE?.anonKey);
const db = configured && window.supabase ? window.supabase.createClient(window.PINOKII_SUPABASE.url, window.PINOKII_SUPABASE.anonKey) : null;
const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function textToParagraphs(text) {
  return String(text || '').split(/\n\s*\n/).map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`).join('');
}

/* ===== 既定の内容（管理画面でまだ何も保存されていないときに使われます） ===== */
const DEFAULT_FORMS = [
  {
    key: 'illustration',
    label: 'イラスト制作',
    description: 'キャラクターデザイン・イラストについてお伺いします',
    intro: `この度はキャラクターデザインのご依頼をご検討いただき、ありがとうございます🙇🏻‍♀️

できるだけ詳しくご記入いただくことで、イメージに沿ったキャラクターデザインを制作しやすくなります。「こんなキャラクターにしたい！」というイメージがありましたら、ぜひ詳しく教えてください！

まだ「決まっていない」「おまかせしたい」という項目がございましたら、無理に決めていただく必要はありません。その場合は空欄のままか、「おまかせ」「相談して決めたい」とご記入ください。`,
    outro: `最後までご回答いただきありがとうございます🙇🏻‍♀️

つきましては、後ほどご回答いただいた内容の確認事項と「キャラクターデザイン」の料金をメッセージにてお送りいたします💬`,
    blocks: [
      { type: 'section', title: '基本情報', english: 'BASIC INFORMATION' },
      { type: 'text', label: 'キャラクターのお名前', helper: 'まだ決まっていない場合は、仮のお名前でも大丈夫です。', required: false },
      { type: 'text', label: '実年齢', helper: '実際の年齢をご記入ください。', required: false },
      { type: 'text', label: '見た目年齢（実年齢と異なる場合のみ）', helper: '同じ場合は空欄で大丈夫です。', required: false },
      { type: 'single_choice', label: '性別', helper: '特殊な設定がある場合は「その他」を選んでください。', required: false, options: ['女性', '男性', 'その他'] },
      { type: 'text', label: '性別の補足（その他を選んだ場合など）', helper: '', required: false },
      { type: 'text', label: '身長（cm）', helper: '', required: false },
      { type: 'text', label: '体重（kg）', helper: '', required: false },
      { type: 'text', label: '胸のサイズ（胸のあるキャラクターのみ）', helper: 'カップ数などをご記入いただけると参考になります。', required: false },
      { type: 'textarea', label: '種類・種族', helper: '人間・獣人・エルフ・吸血鬼・妖怪・ロボットなど。オリジナルの種族の場合は詳しくご記入ください。', required: false },
      { type: 'section', title: 'キャラクターの雰囲気', english: 'CHARACTER VIBE' },
      { type: 'textarea', label: 'イメージカラー・サブカラー', helper: 'メインカラー1色＋サブカラー1〜2色が目安です。決まっていない場合は「おまかせ」でも大丈夫です。', required: false },
      { type: 'textarea', label: '性格・雰囲気', helper: '「明るい」「かわいい」「かっこいい」「ふわふわ」など、大まかなイメージでも大丈夫です。', required: false },
      { type: 'section', title: '外見・デザイン', english: 'APPEARANCE' },
      { type: 'textarea', label: '髪型・髪色', helper: 'ロング・ショート・ツインテールなど。説明が難しい場合は髪色だけでもOKです。', required: false },
      { type: 'textarea', label: '目の形・色', helper: 'タレ目・ツリ目・ジト目・オッドアイなど、目の印象を詳しくご記入ください。', required: false },
      { type: 'textarea', label: 'こだわり・特徴', helper: '猫耳・メガネ・ピアス・片目を隠しているなど、入れてほしい特徴をご記入ください。', required: false },
      { type: 'section', title: '衣装・世界観', english: 'OUTFIT & WORLD' },
      { type: 'textarea', label: '服装のイメージ', helper: '制服、ゴシック、ストリート、和服、ファンタジー、パーカー、ドレスなど。', required: false },
      { type: 'textarea', label: '時代設定・世界観', helper: '現代、近未来、中国風、江戸時代風、中世ヨーロッパ風、SF、ファンタジー、異世界など。決まっていない場合は「おまかせ」でも大丈夫です。', required: false },
      { type: 'section', title: '参考・こだわり・NG', english: 'REFERENCE & MUST' },
      { type: 'textarea', label: '近しいキャラクター', helper: '参考にしたいキャラクターがいる場合は、キャラクター名や作品名をご記入ください。名前が分からない場合は、下の項目から参考画像をアップロードいただくこともできます。', required: false },
      { type: 'image', label: '参考画像（あれば）', helper: 'イメージに近い画像やイラストがあれば、アップロードしてください（複数枚OKです）。', required: false },
      { type: 'textarea', label: '絶対に入れてほしい要素', helper: '獣耳、メガネ、ピアス、片目を髪で隠している、傷・ほくろ・タトゥーなど。', required: false },
      { type: 'textarea', label: '絶対に入れてほしくない要素', helper: '避けてほしい髪型・服装・色・アクセサリーなどがあればご記入ください。', required: false },
      { type: 'textarea', label: 'その他の要望', helper: '上記以外に伝えておきたいことがあれば、自由にご記入ください。', required: false },
      { type: 'section', title: '確認・連絡', english: 'CONFIRMATION' },
      { type: 'text', label: 'お返事しやすい時間帯', helper: 'いつでも大丈夫な場合は空欄で大丈夫です。', required: false }
    ]
  },
  {
    key: 'parts',
    label: 'パーツ分け制作',
    description: '完成イラストのパーツ分けについてお伺いします',
    intro: `この度はパーツ分け（Live2D用のパーツ分け）のご依頼をご検討いただき、ありがとうございます🙇🏻‍♀️

すでに完成しているイラストを、動かせる形にパーツごとに分けていく工程です。以下の項目にご回答いただくことで、ご希望に沿った可動域や仕上がりにしやすくなります。

イラストデータは、下の項目からこのままアップロードしてください。`,
    outro: `最後までご回答いただきありがとうございます🙇🏻‍♀️

つきましては、後ほどご回答いただいた内容の確認事項と「パーツ分け」の料金をメッセージにてお送りいたします💬`,
    blocks: [
      { type: 'section', title: '基本情報', english: 'BASIC INFORMATION' },
      { type: 'text', label: 'キャラクターのお名前', helper: '', required: false },
      { type: 'image', label: 'イラストデータ', helper: 'パーツ分けしたいイラストの画像を、そのままアップロードしてください（複数枚OKです）。', required: false },
      { type: 'single_choice', label: 'ご希望の可動域', helper: '決まっていない場合は「おまかせ」を選んでください。', required: false, options: ['低可動域', '高可動域', 'おまかせ'] },
      { type: 'section', title: 'パーツ分けの詳細', english: 'PARTS DETAIL' },
      { type: 'multi_choice', label: '揺れ物・小物はありますか？', helper: '当てはまるものをすべて選んでください。', required: false, options: ['髪', '衣装（リボン・スカートなど）', 'アクセサリー', '尻尾・耳など', 'その他'] },
      { type: 'textarea', label: '揺れ物・小物の補足', helper: '上で選んだ内容について、詳しくご記入ください（部位や動かし方の希望など）。', required: false },
      { type: 'textarea', label: '表情差分の希望', helper: '笑顔・怒り・照れなど、用意したい表情があればご記入ください。', required: false },
      { type: 'textarea', label: '特殊な動き・ご要望', helper: '「ウィンクしたい」「服を着替えたい」など、特別な動きの希望があればご記入ください。', required: false },
      { type: 'textarea', label: '参考にしたいモデル・動き', helper: '動きの参考にしたいモデルや配信者がいればご記入ください。', required: false },
      { type: 'section', title: '確認・連絡', english: 'CONFIRMATION' },
      { type: 'text', label: 'お返事しやすい時間帯', helper: 'いつでも大丈夫な場合は空欄で大丈夫です。', required: false }
    ]
  }
];

let requestFormsCache = null;
let currentFormKey = null;
let currentQuestions = [];
let currentSerial = '';
let uploadedImages = {};

async function getRequestForms() {
  if (requestFormsCache) return requestFormsCache;
  if (!db) { requestFormsCache = DEFAULT_FORMS; return requestFormsCache; }
  const { data } = await db.from('site_settings').select('key,value').in('key', ['request_forms', 'illustration_form_config', 'parts_form_config']);
  const map = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
  if (map.request_forms) {
    try {
      const parsed = JSON.parse(map.request_forms);
      if (Array.isArray(parsed)) { requestFormsCache = parsed; return requestFormsCache; }
    } catch (error) { /* 壊れていた場合は下の移行処理にフォールバック */ }
  }
  // 旧形式（イラスト・パーツ分けの2つ固定）からの自動移行
  const migrated = [];
  ['illustration_form_config', 'parts_form_config'].forEach((oldKey, index) => {
    if (!map[oldKey]) return;
    try {
      const parsed = JSON.parse(map[oldKey]);
      const base = DEFAULT_FORMS[index];
      migrated.push({ key: base.key, label: base.label, description: base.description, intro: parsed.intro || base.intro, outro: parsed.outro || base.outro, blocks: Array.isArray(parsed.blocks) && parsed.blocks.length ? parsed.blocks : base.blocks });
    } catch (error) { /* 無視して既定を使う */ }
  });
  requestFormsCache = migrated.length ? migrated : DEFAULT_FORMS;
  return requestFormsCache;
}

function blocksToSections(blocks) {
  const sections = [];
  let current = { title: '', english: '', questions: [] };
  let qi = 0;
  (blocks || []).forEach((block) => {
    if (block.type === 'section') {
      if (current.questions.length || current.title) sections.push(current);
      current = { title: block.title || '', english: block.english || '', questions: [] };
      return;
    }
    qi += 1;
    current.questions.push({ ...block, id: `q${qi}` });
  });
  if (current.questions.length || current.title) sections.push(current);
  return sections;
}

function questionTone(label) {
  if (label.includes('入れてほしくない')) return 'ireq-tone-avoid';
  if (label.includes('入れてほしい')) return 'ireq-tone-must';
  return '';
}

function renderQuestion(q) {
  const helperHtml = q.helper ? `<p class="ireq-helper">${escapeHtml(q.helper)}</p>` : '';
  const tone = questionTone(q.label);
  const bodyId = `field-${q.id}`;
  const requiredMark = q.required ? '<span class="ireq-required">必須</span>' : '';
  let inputHtml = '';
  if (q.type === 'textarea') {
    inputHtml = `<textarea id="${bodyId}" name="${q.id}" rows="4" ${q.required ? 'required' : ''}></textarea>`;
  } else if (q.type === 'single_choice') {
    const hasOther = (q.options || []).some((opt) => opt.trim() === 'その他');
    inputHtml = `<div class="ireq-choice-group" role="radiogroup">${(q.options || []).map((opt, oi) => `<label class="ireq-choice"><input type="radio" name="${q.id}" value="${escapeHtml(opt)}" ${opt.trim() === 'その他' ? `data-other-toggle="${q.id}"` : ''} ${q.required ? 'required' : ''} /><span>${escapeHtml(opt)}</span></label>`).join('')}</div>${hasOther ? `<input type="text" class="ireq-other-input" id="other-${q.id}" data-other-for="${q.id}" placeholder="具体的にご記入ください" hidden />` : ''}`;
  } else if (q.type === 'multi_choice') {
    const hasOther = (q.options || []).some((opt) => opt.trim() === 'その他');
    inputHtml = `<div class="ireq-choice-group">${(q.options || []).map((opt, oi) => `<label class="ireq-choice"><input type="checkbox" name="${q.id}" value="${escapeHtml(opt)}" data-multi="${q.id}" ${opt.trim() === 'その他' ? `data-other-toggle="${q.id}"` : ''} /><span>${escapeHtml(opt)}</span></label>`).join('')}</div>${hasOther ? `<input type="text" class="ireq-other-input" id="other-${q.id}" data-other-for="${q.id}" placeholder="具体的にご記入ください" hidden />` : ''}`;
  } else if (q.type === 'image') {
    inputHtml = `<div class="ireq-image-upload">
      <label class="ireq-image-button" for="${bodyId}">📎 画像・PSDファイルを選ぶ（複数可）</label>
      <input id="${bodyId}" type="file" accept="image/*,.psd" multiple data-image-question="${q.id}" hidden />
      <div class="ireq-image-previews" id="previews-${q.id}"></div>
      <p class="ireq-image-status" id="status-${q.id}"></p>
    </div>`;
  } else {
    inputHtml = `<input id="${bodyId}" name="${q.id}" type="text" ${q.required ? 'required' : ''} />`;
  }
  return `<div class="ireq-question ${tone}" data-question-type="${q.type}" data-question-id="${q.id}">
    <label for="${bodyId}" class="ireq-q-label">${escapeHtml(q.label)}${requiredMark}</label>
    ${helperHtml}
    ${inputHtml}
  </div>`;
}

function renderSection(section, index) {
  const heading = section.title
    ? `<div class="ireq-section-head"><span class="ireq-section-num">${String(index + 1).padStart(2, '0')}</span><div><h2>${escapeHtml(section.title)}</h2>${section.english ? `<small>${escapeHtml(section.english)}</small>` : ''}</div></div>`
    : '';
  return `<section class="ireq-section">${heading}<div class="ireq-section-body">${section.questions.map(renderQuestion).join('')}</div></section>`;
}

async function showKindChoice() {
  const forms = await getRequestForms();
  const box = $('#ireq-kind-choices');
  if (!forms.length) {
    box.innerHTML = '<p class="ireq-lead">現在ご利用いただける依頼フォームがありません。お手数ですが、公式XまたはDiscordまで直接ご連絡ください。</p>';
  } else {
    box.innerHTML = forms.map((form) => `<button type="button" class="ireq-kind-card" data-form-key="${escapeHtml(form.key)}"><b>${escapeHtml(form.label)}</b><span>${escapeHtml(form.description || '')}</span></button>`).join('');
  }
  $('#ireq-code-step').hidden = true;
  $('#ireq-kind-step').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function openForm(key) {
  const forms = await getRequestForms();
  const config = forms.find((form) => form.key === key);
  if (!config) return;
  currentFormKey = key;
  uploadedImages = {};
  const sections = blocksToSections(config.blocks);
  currentQuestions = sections.flatMap((section) => section.questions);
  $('#ireq-intro').innerHTML = textToParagraphs(config.intro);
  $('#ireq-outro').innerHTML = textToParagraphs(config.outro);
  $('#ireq-serial-display').textContent = currentSerial;
  $('#ireq-form-kind-label').textContent = config.label || '';
  $('#ireq-questions').innerHTML = sections.map(renderSection).join('');
  $('#ireq-kind-step').hidden = true;
  $('#ireq-form-step').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleCodeSubmit(event) {
  event.preventDefault();
  const message = $('#ireq-code-message');
  const serial = $('#ireq-serial').value.trim();
  if (!serial) return;
  message.style.color = '#c14978';
  if (!db) { message.textContent = '現在この機能は準備中です。しばらくしてから再度お試しください。'; return; }
  message.textContent = '確認中…';
  const { data: exists, error } = await db.rpc('check_inquiry_serial', { p_serial: serial });
  if (error) { message.textContent = `確認できませんでした：${error.message}`; return; }
  if (!exists) { message.textContent = 'そのお客様コードが見つかりませんでした。入力内容をご確認ください。'; return; }
  message.textContent = '';
  currentSerial = serial;
  await showKindChoice();
}

function updateOtherFieldVisibility(name) {
  const otherInput = document.getElementById(`other-${name}`);
  if (!otherInput) return;
  const otherToggle = document.querySelector(`[data-other-toggle="${name}"]`);
  if (!otherToggle) return;
  otherInput.hidden = !otherToggle.checked;
  if (!otherToggle.checked) otherInput.value = '';
}

function otherDetailFor(qid) {
  const otherInput = document.getElementById(`other-${qid}`);
  return otherInput && !otherInput.hidden ? otherInput.value.trim() : '';
}

function collectAnswers(form) {
  const answers = {};
  currentQuestions.forEach((q) => {
    if (q.type === 'multi_choice') {
      const checked = [...form.querySelectorAll(`[data-multi="${q.id}"]:checked`)].map((el) => el.value);
      const detail = otherDetailFor(q.id);
      const withDetail = detail ? checked.map((value) => (value.trim() === 'その他' ? `その他（${detail}）` : value)) : checked;
      answers[q.label] = withDetail.join('、');
    } else if (q.type === 'image') {
      answers[q.label] = uploadedImages[q.id] || [];
    } else if (q.type === 'single_choice') {
      const value = form.elements[q.id]?.value || '';
      const detail = otherDetailFor(q.id);
      answers[q.label] = (value.trim() === 'その他' && detail) ? `その他（${detail}）` : value;
    } else {
      answers[q.label] = form.elements[q.id]?.value || '';
    }
  });
  return answers;
}

/* ===== 追加機能：回答が届いたらDiscordへ通知 ===== */
async function notifyDiscord(key, serial) {
  if (!db) return;
  const { data } = await db.from('site_settings').select('key,value').in('key', ['discord_webhook_url', 'discord_notify_enabled']);
  const map = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
  const url = map.discord_webhook_url;
  const enabled = String(map.discord_notify_enabled ?? true) !== 'false';
  if (!url || !enabled) return;
  const forms = await getRequestForms();
  const kindLabel = forms.find((form) => form.key === key)?.label || key;
  const content = `📋 依頼フォームの回答が届きました\n種類：${kindLabel}\nお客様コード：${serial}\n\n依頼管理の「依頼票」タブからご確認ください。`;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
  } catch (error) { /* 通知が失敗しても、回答の送信自体は成功しているので何もしない */ }
}

async function handleAnswerSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#ireq-submit-message');
  const confirmBox = $('#ireq-confirm');
  message.style.color = '#c14978';
  if (confirmBox && !confirmBox.checked) { message.textContent = '送信前に「入力内容を確認しました」にチェックをお願いします。'; confirmBox.closest('.ireq-confirm-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const answers = collectAnswers(form);
  message.textContent = '送信中…';
  const { error } = await db.from('illustration_requests').insert({ serial: currentSerial, answers, form_type: currentFormKey });
  if (error) {
    if (/form_type/.test(error.message)) {
      // supabase/parts-request.sql が未実行の環境でも送信できるようにする
      const { error: retryError } = await db.from('illustration_requests').insert({ serial: currentSerial, answers });
      if (retryError) { message.textContent = `送信できませんでした：${retryError.message}`; return; }
    } else {
      message.textContent = `送信できませんでした：${error.message}`;
      return;
    }
  }
  notifyDiscord(currentFormKey, currentSerial);
  $('#ireq-form-step').hidden = true;
  $('#ireq-done-step').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===== 追加機能：画像添付のアップロード処理 ===== */
async function handleImageUpload(input) {
  const qid = input.dataset.imageQuestion;
  const previews = document.getElementById(`previews-${qid}`);
  const status = document.getElementById(`status-${qid}`);
  const files = [...input.files];
  if (!files.length) return;
  if (!uploadedImages[qid]) uploadedImages[qid] = [];
  status.textContent = `アップロード中…（0/${files.length}）`;
  let done = 0;
  for (const file of files) {
    try {
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const { error } = await db.storage.from('request-attachments').upload(safeName, file, { upsert: false });
      if (error) throw error;
      const url = db.storage.from('request-attachments').getPublicUrl(safeName).data.publicUrl;
      uploadedImages[qid].push(url);
      const isPsd = /\.psd$/i.test(file.name);
      const thumbHtml = isPsd
        ? `<span class="ireq-image-thumb is-file"><span class="ireq-file-icon">🖼️</span><span class="ireq-file-name">${escapeHtml(file.name)}</span></span>`
        : `<span class="ireq-image-thumb"><img src="${url}" alt="" /></span>`;
      previews.insertAdjacentHTML('beforeend', thumbHtml);
    } catch (error) {
      status.textContent = `一部の画像をアップロードできませんでした：${error.message}`;
    }
    done += 1;
    if (status.textContent.startsWith('アップロード中')) status.textContent = `アップロード中…（${done}/${files.length}）`;
  }
  if (status.textContent.startsWith('アップロード中')) status.textContent = `✓ ${uploadedImages[qid].length}枚アップロード済み`;
  input.value = '';
}

function init() {
  $('#ireq-code-form').addEventListener('submit', handleCodeSubmit);
  $('#ireq-answer-form').addEventListener('submit', handleAnswerSubmit);
  $('#ireq-kind-choices').addEventListener('click', (event) => { const card = event.target.closest('[data-form-key]'); if (card) openForm(card.dataset.formKey); });
  $('#ireq-kind-back').addEventListener('click', () => { $('#ireq-kind-step').hidden = true; $('#ireq-code-step').hidden = false; });
  $('#ireq-form-back').addEventListener('click', () => { $('#ireq-form-step').hidden = true; $('#ireq-kind-step').hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#ireq-questions').addEventListener('change', (event) => {
    if (event.target.matches('[data-image-question]')) handleImageUpload(event.target);
    if (event.target.matches('[name]') && event.target.type !== 'file') updateOtherFieldVisibility(event.target.name);
  });
}

init();
