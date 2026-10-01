const configured = Boolean(window.PINOKII_SUPABASE?.url && window.PINOKII_SUPABASE?.anonKey);
const db = configured && window.supabase ? window.supabase.createClient(window.PINOKII_SUPABASE.url, window.PINOKII_SUPABASE.anonKey) : null;
const $ = (selector) => document.querySelector(selector);
const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;

const STATUS = {
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
const PAYMENT = {
  unpaid: { label: '未払い', cls: 'pay-unpaid' },
  wait: { label: '支払い確認待ち', cls: 'pay-wait' },
  paid: { label: '支払い済み', cls: 'pay-paid' },
  partial: { label: '一部入金', cls: 'pay-partial' },
  refunded: { label: '返金済み', cls: 'pay-refunded' }
};
const STEPS = [
  { id: 'confirm', label: '依頼内容確認' }, { id: 'payment', label: '入金確認' }, { id: 'psd', label: 'PSD受け取り' },
  { id: 'modeling', label: 'モデリング' }, { id: 'vts', label: 'VTube Studio確認' }, { id: 'client', label: 'クライアント確認' },
  { id: 'revision', label: '修正' }, { id: 'final', label: '最終確認' }, { id: 'deliver', label: '納品' }
];
const FILE_KINDS = [
  { id: 'psd', label: 'PSD' }, { id: 'parts-psd', label: 'パーツ分け済みPSD' }, { id: 'moc3', label: 'moc3' },
  { id: 'model3json', label: 'model3.json' }, { id: 'physics3json', label: 'physics3.json' }, { id: 'texture', label: 'テクスチャ' },
  { id: 'vts', label: 'VTube Studio用データ' }, { id: 'delivery', label: '納品データ' }, { id: 'video', label: '動画' },
  { id: 'ref', label: '参考画像' }, { id: 'other', label: 'その他' }
];
const STEP_IDS = STEPS.map((step) => step.id);

/* ===== 追加機能：表情の種類を管理し、依頼ごとの進捗ステップに反映 ===== */
let expressionCatalog = [];

function parseExpressionCatalog(raw) {
  return String(raw || '').split('\n').map((line) => line.trim()).filter(Boolean);
}

async function loadExpressionCatalog() {
  if (!db) return;
  const { data } = await db.from('site_settings').select('value').eq('key', 'expression_catalog').maybeSingle();
  expressionCatalog = parseExpressionCatalog(data?.value ?? '');
  if (!expressionCatalog.length) expressionCatalog = ['笑顔', '怒り', '困り', '驚き', '泣く', 'ウィンク'];
}

async function saveExpressionCatalog(raw) {
  const { error } = await db.from('site_settings').upsert({ key: 'expression_catalog', value: raw });
  if (error) throw error;
  await loadExpressionCatalog();
}

function exprOf(item) { return Array.isArray(item.expressions_needed) ? item.expressions_needed : []; }

function stepsForItem(item) {
  const steps = STEPS.slice();
  if (item.illustration_needed) steps.push({ id: 'illust', label: `${scopeLabels.illustration}確認` });
  if (item.chardesign_needed) steps.push({ id: 'chardesign', label: `${scopeLabels.chardesign}確認` });
  exprOf(item).forEach((name) => steps.push({ id: `expr:${name}`, label: `表情：${name}` }));
  return steps;
}

/* ===== 追加機能③：定型文コピー ===== */
const DEFAULT_MESSAGE_TEMPLATES = [
  { label: '最初のご挨拶（依頼フォームのご案内）', body: '{{name}} 様\n\nこの度は「きのぴー。」へご依頼・ご相談いただき、\nありがとうございます！\n\nイラスト制作・Live2D制作について、\nこれから内容を確認しながらご案内させていただきます。\n\nまずは、下記のお客様コードをコピーして、\n依頼フォームへお進みください。\n\n━━━━━━━━━━━━━━━━━━\n🎫 お客様コード\n{{serial}}\n━━━━━━━━━━━━━━━━━━\n\n【ご依頼の流れ】\n\n① お客様コードをコピー\n↓\n② 下記URLから「依頼フォーム」を開く\nhttps://example.com/illustration-request.html\n↓\n③ お客様コードを貼り付ける\n↓\n④ ご希望の制作内容を入力\n↓\n⑤ 内容を確認して送信\n\nお客様コードは、今回のご依頼を管理するために使用します。\nフォームへ入力する際は、上記のコードをそのままコピーしてご利用ください。\n\nご不明な点や「まだ内容が決まっていない」という場合も、\nお気軽にご相談ください！\n\nそれでは、フォームよりご依頼内容をお聞かせください。\nよろしくお願いいたします。' },
  { label: 'お見積りのご案内', body: '{{name}} 様\n\nお問い合わせいただきありがとうございます。ぴのきー。です。\nご相談いただいた内容から、お見積りは {{total}} となります。\n\nシリアルナンバー：{{serial}}\n\n内容にご納得いただけましたら、このままご準備を進めさせていただきます。\nご不明な点があれば、いつでもお気軽にご連絡ください。' },
  { label: '制作内容のご確認をお願い', body: '{{name}} 様\n\nお見積り金額が確定いたしましたので、制作内容とお見積りのご確認をお願いいたします🙇🏻‍♀️\n\n下記のページから、お客様コードをご入力のうえご確認ください。\n\nhttps://example.com/order-confirmation.html\n\nお客様コード：{{serial}}\n\nご確認いただき、内容に同意いただけましたら、そのまま制作を進めさせていただきます。' },
  { label: '納期のご連絡', body: '{{name}} 様\n\nいつもありがとうございます。ぴのきー。です。\n現在の納品予定日は {{due}} を予定しております。\n進捗は下記のページからもご確認いただけます。\nhttps://example.com/status.html?serial={{serial}}\n\n何かご希望がございましたら、お気軽にお知らせください。' },
  { label: '確認のお願い（awaiting）', body: '{{name}} 様\n\nお待たせいたしました！ぴのきー。です。\n制作が進みましたので、ご確認をお願いいたします。\n\nシリアルナンバー：{{serial}}\n\nご確認後、気になる点や修正のご希望があればお知らせください。' },
  { label: '修正回数を超えた場合のご案内', body: '{{name}} 様\n\nご連絡ありがとうございます。ぴのきー。です。\nご契約内容の無料修正回数（{{revLimit}}回）を超えるご希望となるため、追加修正として承ることができます。\n\n追加修正の内容と料金は、あらためてご案内いたします。' },
  { label: '依頼フォームのご案内', body: '{{name}} 様\n\nぴのきー。です。\n詳しくお伺いしたいことがございますので、下記のフォームからご回答をお願いいたします🙇🏻‍♀️\n\nhttps://example.com/illustration-request.html\n\nお客様コード：{{serial}}\n\n↑のコードを「お客様コード」欄にご入力いただくと、「イラスト制作」「パーツ分け制作」のどちらかを選んでご回答いただけます。決まっていない項目は空欄で大丈夫です。' },
  { label: '納品のご連絡', body: '{{name}} 様\n\nお待たせいたしました！ぴのきー。です。\nモデルが完成いたしましたので、ファイルをお送りいたします。\n\nシリアルナンバー：{{serial}}\n\nご不明点があれば、いつでもご連絡くださいませ。この度はご依頼いただき、誠にありがとうございました♡' }
];

let messageTemplates = DEFAULT_MESSAGE_TEMPLATES;

function parseMessageTemplates(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  return text.split(/^\s*===\s*$/m).map((block) => {
    const lines = block.split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) return null;
    const label = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();
    return label && body ? { label, body } : null;
  }).filter(Boolean);
}

async function loadMessageTemplates() {
  if (!db) return;
  const { data } = await db.from('site_settings').select('value').eq('key', 'message_templates').maybeSingle();
  const parsed = parseMessageTemplates(data?.value ?? '');
  messageTemplates = parsed.length ? parsed : DEFAULT_MESSAGE_TEMPLATES;
  const openItem = currentDetailItem();
  if (openItem) renderTemplatesPanel(openItem);
}

function fillTemplate(body, item) {
  const revLimit = Number(item.revision_limit ?? 2);
  const revUsed = Number(item.revision_used || 0);
  const map = {
    name: item.request_name || '',
    serial: item.serial || '',
    due: item.due_date ? fmtDate(item.due_date) : '未定',
    total: item.total ? yen(item.total) : '要お見積り',
    revLimit: String(revLimit),
    revUsed: String(revUsed),
    revLeft: String(Math.max(revLimit - revUsed, 0))
  };
  const filled = body.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in map ? map[key] : match));
  return siteBaseUrl ? filled.replace(/https:\/\/example\.com/g, siteBaseUrl) : filled;
}

/* ===== 追加機能：各種URLをコピー ===== */
const URL_COPY_PAGES = [
  { label: 'ホームページ', path: '' },
  { label: '依頼フォーム（イラスト・パーツ分け）', path: 'illustration-request.html' },
  { label: '制作内容のご確認ページ', path: 'order-confirmation.html' },
  { label: '進捗確認ページ', path: 'status.html' },
  { label: '特定商取引法に基づく表記', path: 'tokushoho.html' }
];

function parseUrlCopyExtra(raw) {
  return String(raw || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label, path] = line.split('|');
    if (!label || !path) return null;
    return { label: label.trim(), path: path.trim() };
  }).filter(Boolean);
}

function renderUrlCopyList() {
  const box = $('#od-url-list');
  if (!box) return;
  const base = siteBaseUrl || 'https://example.com';
  const builtIn = URL_COPY_PAGES.map((page) => ({ ...page, isBuiltIn: true }));
  const extra = parseUrlCopyExtra(urlCopyExtraRaw).map((page, index) => ({ ...page, isBuiltIn: false, extraIndex: index }));
  const pages = [...builtIn, ...extra];
  box.innerHTML = pages.map((page) => {
    const url = /^https?:\/\//.test(page.path) ? page.path : (page.path ? `${base}/${page.path}` : `${base}/`);
    const editAttr = page.isBuiltIn ? 'data-edit-base-url="true"' : `data-edit-extra-url="${page.extraIndex}"`;
    const editLabel = page.isBuiltIn ? 'サイトURLを編集' : '編集';
    return `<div class="url-copy-row ${page.isBuiltIn ? 'is-built-in' : ''}"><b>${escapeHtml(page.label)}</b><span>${escapeHtml(url)}</span><div class="url-copy-actions"><button type="button" class="od-mini-button" data-copy-url="${escapeHtml(url)}">コピー</button><button type="button" class="od-mini-button is-ghost" ${editAttr}>${editLabel}</button></div></div>`;
  }).join('') + '<p class="od-hint">「ホームページ」〜「特定商取引法」の4つは、下の1つの「サイトの公開URL」から自動で作られています。どれか1つを編集すると、4つ全部が一緒に変わります。' + (siteBaseUrl ? '' : ' まだ設定されていないため、今はサンプルのURLが表示されています。') + '</p>';
}

async function editSiteBaseUrl() {
  const next = prompt('サイトの公開URLを入力してください（例：https://kinopi.vercel.app）\n\n※この設定は「ホームページ」〜「特定商取引法」の4つのURLすべてに使われます。パスや「?」以降は自動で取り除かれます。', siteBaseUrl || 'https://');
  if (next === null) return;
  let trimmed = next.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(trimmed);
    trimmed = parsed.origin; // ドメイン部分だけを残す（パスや ?utm_source=... などのおまけを自動で削除）
  } catch (error) {
    alert('URLの形式が正しくありません（例：https://kinopi.vercel.app のように入力してください）');
    return;
  }
  const { error } = await db.from('site_settings').upsert({ key: 'site_base_url', value: trimmed });
  if (error) { alert(`保存できませんでした：${error.message}`); return; }
  siteBaseUrl = trimmed;
  renderUrlCopyList();
}

async function addExtraUrl() {
  const next = prompt('表示名｜パスまたはフルURL の形式で入力してください\n例：X（旧Twitter）|https://x.com/Qinopy0104\n例：体験版フォーム|sample-form.html');
  if (next === null || !next.trim()) return;
  const [label, path] = next.split('|');
  if (!label || !path) { alert('「表示名｜URL」の形式で入力してください。'); return; }
  const list = parseUrlCopyExtra(urlCopyExtraRaw);
  list.push({ label: label.trim(), path: path.trim() });
  const raw = list.map((item) => `${item.label}|${item.path}`).join('\n');
  const { error } = await db.from('site_settings').upsert({ key: 'url_copy_extra', value: raw });
  if (error) { alert(`保存できませんでした：${error.message}`); return; }
  urlCopyExtraRaw = raw;
  renderUrlCopyList();
}
async function editExtraUrl(index) {
  const list = parseUrlCopyExtra(urlCopyExtraRaw);
  const current = list[index];
  const next = prompt('表示名｜パスまたはフルURL の形式で入力してください（空欄にすると削除されます）', current ? `${current.label}|${current.path}` : '');
  if (next === null) return;
  if (!next.trim()) { list.splice(index, 1); } else {
    const [label, path] = next.split('|');
    if (!label || !path) { alert('「表示名｜URL」の形式で入力してください。'); return; }
    list[index] = { label: label.trim(), path: path.trim() };
  }
  const raw = list.map((item) => `${item.label}|${item.path}`).join('\n');
  const { error } = await db.from('site_settings').upsert({ key: 'url_copy_extra', value: raw });
  if (error) { alert(`保存できませんでした：${error.message}`); return; }
  urlCopyExtraRaw = raw;
  renderUrlCopyList();
}

async function copyUrlToClipboard(url, button) {
  try {
    await navigator.clipboard.writeText(url);
    const original = button.textContent;
    button.textContent = 'コピーしました！';
    setTimeout(() => { button.textContent = original; }, 1800);
  } catch (error) {
    alert(`コピーできませんでした。\n\n${url}`);
  }
}

function serializeMessageTemplates(list) {
  return list.map((tpl) => `${tpl.label}\n${tpl.body}`).join('\n===\n');
}

async function saveMessageTemplates(list) {
  const raw = serializeMessageTemplates(list);
  const { error } = await db.from('site_settings').upsert({ key: 'message_templates', value: raw });
  if (error) throw error;
  await loadMessageTemplates();
}

function renderTemplatesPanel(item) {
  const box = $('#od-template-list');
  if (!box) return;
  const total = messageTemplates.length;
  box.innerHTML = messageTemplates.map((tpl, index) => `<div class="tmpl-item">
    <div class="tmpl-move-buttons">
      <button type="button" class="tmpl-move-button" data-tmpl-move="${index}:-1" ${index === 0 ? 'disabled' : ''} title="上へ">▲</button>
      <button type="button" class="tmpl-move-button" data-tmpl-move="${index}:1" ${index === total - 1 ? 'disabled' : ''} title="下へ">▼</button>
    </div>
    <b>${escapeHtml(tpl.label)}</b>
    <div class="tmpl-item-actions"><button type="button" class="od-mini-button" data-tmpl-copy="${index}">コピーする</button><button type="button" class="od-mini-button is-ghost" data-tmpl-edit="${index}">編集</button></div>
  </div>`).join('') || '<p class="od-hint">まだ定型文がありません。「＋ 新しいテンプレ文を追加」から作成できます。</p>';
}

async function moveMessageTemplate(index, direction) {
  const j = index + direction;
  if (j < 0 || j >= messageTemplates.length) return;
  const list = messageTemplates.slice();
  [list[index], list[j]] = [list[j], list[index]];
  try {
    await saveMessageTemplates(list);
    renderTemplatesPanel();
  } catch (error) {
    alert(`並び替えを保存できませんでした：${error.message}`);
  }
}

function openTmplMsgDialog(index) {
  const isNew = index === null || index === undefined;
  const tpl = isNew ? { label: '', body: '' } : messageTemplates[index];
  if (!tpl) return;
  $('#tmpl-msg-title').textContent = isNew ? '新しいテンプレ文を追加' : 'テンプレ文を編集';
  $('#tmpl-msg-index').value = isNew ? '' : String(index);
  $('#tmpl-msg-label').value = tpl.label;
  $('#tmpl-msg-body').value = tpl.body;
  $('#tmpl-msg-delete').hidden = isNew;
  $('#tmpl-msg-message').textContent = '';
  $('#tmpl-msg-dialog').showModal();
}

async function saveTmplMsgForm() {
  const indexStr = $('#tmpl-msg-index').value;
  const label = $('#tmpl-msg-label').value.trim();
  const body = $('#tmpl-msg-body').value.trim();
  if (!label || !body) { $('#tmpl-msg-message').textContent = 'テンプレ名と本文の両方を入力してください。'; return; }
  const list = messageTemplates.slice();
  if (indexStr === '') list.push({ label, body });
  else list[Number(indexStr)] = { label, body };
  try {
    await saveMessageTemplates(list);
    $('#tmpl-msg-dialog').close();
  } catch (error) {
    $('#tmpl-msg-message').textContent = `保存できませんでした：${error.message}`;
  }
}

async function deleteTmplMsg() {
  const indexStr = $('#tmpl-msg-index').value;
  if (indexStr === '' || !confirm('この定型文を削除しますか？')) return;
  const list = messageTemplates.slice();
  list.splice(Number(indexStr), 1);
  try {
    await saveMessageTemplates(list);
    $('#tmpl-msg-dialog').close();
  } catch (error) {
    $('#tmpl-msg-message').textContent = `削除できませんでした：${error.message}`;
  }
}

async function copyTemplate(index, item, button) {
  const tpl = messageTemplates[index];
  if (!tpl) return;
  const text = fillTemplate(tpl.body, item);
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = 'コピーしました！';
    setTimeout(() => { button.textContent = original; }, 1800);
  } catch (error) {
    alert(`コピーできませんでした。お使いのブラウザではこの機能が使えない可能性があります。\n\n${text}`);
  }
}

/* ===== 追加機能④：納期カレンダー ===== */
let calState = null;

function calKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function renderCalendar() {
  const grid = $('#cal-grid');
  if (!grid) return;
  if (!calState) { const now = new Date(); calState = { year: now.getFullYear(), month: now.getMonth() }; }
  const { year, month } = calState;
  $('#cal-month').textContent = `${year}年${month + 1}月`;

  const dueMap = {};
  inquiries.forEach((item) => {
    if (!isActive(item) || !item.due_date) return;
    const key = String(item.due_date).slice(0, 10);
    (dueMap[key] = dueMap[key] || []).push(item);
  });

  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = calKey(new Date());

  let cells = '';
  ['日', '月', '火', '水', '木', '金', '土'].forEach((label) => { cells += `<div class="cal-weekday">${label}</div>`; });
  for (let i = 0; i < startWeekday; i += 1) cells += '<div class="cal-cell is-empty"></div>';
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = calKey(date);
    const items = dueMap[key] || [];
    const isToday = key === todayKey;
    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0)) && items.length;
    const busyClass = items.length >= 3 ? 'is-busy' : (items.length ? 'has-due' : '');
    cells += `<button type="button" class="cal-cell ${busyClass} ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}" data-cal-day="${key}">
      <span>${day}</span>
      ${items.length ? `<i class="cal-dot">${items.length}</i>` : ''}
    </button>`;
  }
  grid.innerHTML = cells;

  const listBox = $('#cal-day-list');
  const selected = grid.dataset.selected;
  if (selected && dueMap[selected]) renderCalDayList(selected, dueMap[selected]);
  else listBox.innerHTML = '<p class="od-hint">日付をタップすると、その日が納期の依頼を表示します。</p>';
}

function renderCalDayList(key, items) {
  const listBox = $('#cal-day-list');
  const d = new Date(`${key}T00:00:00`);
  listBox.innerHTML = `<p class="cal-day-title">${d.getMonth() + 1}月${d.getDate()}日の納期${items.length >= 3 ? '（この日は集中しています ⚠）' : ''}</p>` +
    items.map((item) => `<button type="button" class="cal-day-item" data-open-detail="${item.id}"><b>${escapeHtml(item.request_name)}</b><small>${escapeHtml(item.serial)} <i>→</i></small></button>`).join('');
}

/* ===== 追加機能⑥：CSV / JSONエクスポート ===== */
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function csvEscape(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function exportSalesCsv() {
  const rows = [['シリアル', '依頼名', '入金日', '入金額', 'ステータス', '支払い状況']];
  inquiries.filter((item) => item.paid_date).sort((a, b) => new Date(a.paid_date) - new Date(b.paid_date)).forEach((item) => {
    rows.push([item.serial, item.request_name, item.paid_date, Number(item.paid_amount || 0), STATUS[orderStatusOf(item)]?.label || '', PAYMENT[paymentOf(item)]?.label || '']);
  });
  const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')}`;
  downloadFile(`pinokii-sales-${todayStr()}.csv`, csv, 'text/csv');
}
function exportBackupJson() {
  const payload = {
    exported_at: new Date().toISOString(),
    inquiries,
    processes: (typeof processData !== 'undefined' && processData.processes) || [],
    tasks: (typeof processData !== 'undefined' && processData.tasks) || [],
    revision_log: (typeof processData !== 'undefined' && processData.logs) || []
  };
  downloadFile(`pinokii-backup-${todayStr()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

let inquiries = [];
let currentFilter = 'all';
let currentSearch = '';
let statusFilter = 'all';
let paymentFilter = 'all';
let dueFilter = 'all';
let planFilter = 'all';
let memoTimers = {};
let editingId = null;
let deleteTargetId = null;
let detailId = null;
let detailDirty = false;

function markDetailDirty() {
  if (detailDirty) return;
  detailDirty = true;
  const el = $('#od-dirty-indicator');
  if (el) { el.textContent = '未保存の変更があります'; el.classList.remove('is-saved'); el.classList.add('is-dirty'); }
}

function markDetailSaved() {
  detailDirty = false;
  const el = $('#od-dirty-indicator');
  if (el) { el.textContent = '保存済み'; el.classList.remove('is-dirty'); el.classList.add('is-saved'); }
}

function showApp(session) {
  $('#setup-message').hidden = true;
  $('#login-panel').hidden = Boolean(session);
  $('#inquiries-panel').hidden = !session;
  if (session) loadInquiries();
}

async function checkAuth() {
  if (!configured) { $('#setup-message').hidden = false; return; }
  const { data: { session } } = await db.auth.getSession();
  showApp(session);
  db.auth.onAuthStateChange((_event, newSession) => showApp(newSession));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function statusOf(item) { return item.replied ? 'done' : 'pending'; }
function orderStatusOf(item) { return STATUS[item.order_status] ? item.order_status : 'received'; }
function paymentOf(item) { return PAYMENT[item.payment_status] ? item.payment_status : 'unpaid'; }
function stepsOf(item) { const ids = stepsForItem(item).map((step) => step.id); return Array.isArray(item.progress_steps) ? item.progress_steps.filter((key) => ids.includes(key)) : []; }
function filesOf(item) { return Array.isArray(item.files) ? item.files : []; }
function extrasOf(item) { return Array.isArray(item.extra_items) ? item.extra_items : []; }
function isActive(item) { return !['completed', 'cancelled', 'delivered'].includes(orderStatusOf(item)); }

/* ===== 追加：一覧・詳細で使う「表示用ステータス」（既存の order_status / replied などから計算するだけ。データは変更しません） ===== */
const DISPLAY_STATUS = {
  unreplied: { label: '未返信', cls: 'ds-unreplied', mark: '●', attention: true },
  hearing: { label: 'ヒアリング中', cls: 'ds-hearing', mark: '◔', attention: false },
  pricewait: { label: '料金確認待ち', cls: 'ds-pricewait', mark: '◐', attention: true },
  agreewait: { label: '同意待ち', cls: 'ds-agreewait', mark: '◑', attention: true },
  agreed: { label: '同意済み', cls: 'ds-agreed', mark: '✓', attention: false },
  working: { label: '制作中', cls: 'ds-working', mark: '▶', attention: false },
  reviewing: { label: '確認中', cls: 'ds-reviewing', mark: '◎', attention: false },
  delivered: { label: '納品済み', cls: 'ds-delivered', mark: '★', attention: false },
  cancelled: { label: 'キャンセル', cls: 'ds-cancelled', mark: '×', attention: false }
};

function displayStatusKey(item) {
  const os = orderStatusOf(item);
  if (os === 'cancelled' || item.cancelled) return 'cancelled';
  if (os === 'delivered' || os === 'completed') return 'delivered';
  if (!item.replied) return 'unreplied';
  if (os === 'awaiting' || os === 'final') return 'reviewing';
  if (os === 'working' || os === 'revising') return 'working';
  if (item.confirmation_agreed_at) return 'agreed';
  if (Number(item.total || 0) > 0) return 'agreewait';
  return (item.hearing_summary && String(item.hearing_summary).trim()) ? 'pricewait' : 'hearing';
}

function displayStatusOf(item) { const key = displayStatusKey(item); return { key, ...DISPLAY_STATUS[key] }; }

// 「次にやること」カード・ヘッダーの短い説明文に使う内容（ステータスごとに自動で切り替わる）
const NEXT_ACTION = {
  unreplied: { text: 'お客様へ返信してください。', waiting: '現在、お客様への最初のご返信をお待たせしています。' },
  hearing: { text: 'ヒアリング内容を確認してください。', waiting: '現在、ヒアリング内容の確認待ちです。' },
  pricewait: { text: '見積もり内容を確認してください。', waiting: '現在、お見積り内容のご案内をお待たせしています。' },
  agreewait: { text: 'お客様の同意を待っています。', waiting: '現在、お客様に料金・制作内容の確認と同意をお願いしています。', link: 'order-confirmation.html' },
  agreed: { text: 'お支払い・制作準備を進めてください。', waiting: '内容にご同意いただきました。制作準備を進めましょう。' },
  working: { text: '制作を進めてください。', waiting: '現在、制作を進めています。' },
  reviewing: { text: 'お客様からの確認を待っています。', waiting: '現在、お客様からのご確認・修正依頼をお待ちしています。' },
  delivered: { text: '対応完了です。', waiting: '納品が完了しています。' },
  cancelled: { text: '対応は不要です。', waiting: 'この依頼はキャンセルされています。' }
};

// 「今すぐ対応が必要な理由」の一覧（空なら要対応ではない）
function attentionReasons(item) {
  const reasons = [];
  const ds = displayStatusOf(item);
  if (ds.attention) reasons.push(ds.label);
  if (isActive(item)) {
    const due = dueInfo(item);
    const days = daysUntil(String(item.due_date || '').slice(0, 10));
    if (due.level === 'overdue') reasons.push('納期超過');
    else if (due.level === 'today') reasons.push('本日納期');
    else if (days !== null && days >= 0 && days <= 3) reasons.push(`納期まで${days}日`);
  }
  if (awaitingTooLong(item)) reasons.push('確認待ちが長引いています');
  if (stalled(item)) reasons.push('制作が止まっています');
  if (revisionOver(item)) reasons.push('無料修正回数を超過');
  return reasons;
}

/* ===== 追加機能：あとからオプションを追加できるようにする ===== */
let catalogOptions = [];
let catalogFees = { illustration: 0, chardesign: 0 };
let scopeLabels = { illustration: 'イラスト制作', chardesign: 'キャラクターデザイン', partsReady: 'パーツ分け済みイラスト' };
let siteBaseUrl = '';
let requestFormLabels = null;

async function getRequestFormLabel(key) {
  if (!requestFormLabels) {
    requestFormLabels = {};
    const { data } = await db.from('site_settings').select('key,value').in('key', ['request_forms', 'illustration_form_config', 'parts_form_config']);
    const map = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
    if (map.request_forms) {
      try { (JSON.parse(map.request_forms) || []).forEach((form) => { requestFormLabels[form.key] = form.label; }); } catch (error) { /* 無視 */ }
    } else {
      if (map.illustration_form_config) requestFormLabels.illustration = 'イラスト制作';
      if (map.parts_form_config) requestFormLabels.parts = 'パーツ分け制作';
    }
    if (!requestFormLabels.illustration) requestFormLabels.illustration = 'イラスト制作';
    if (!requestFormLabels.parts) requestFormLabels.parts = 'パーツ分け制作';
  }
  return requestFormLabels[key] || key;
}
let urlCopyExtraRaw = '';

async function loadCatalog() {
  if (!db) return;
  const [optionsRes, settingsRes] = await Promise.all([
    db.from('options').select('*').eq('active', true).order('sort_order'),
    db.from('site_settings').select('key,value').in('key', ['illustration_price_min', 'chardesign_price_min', 'illustration_label', 'chardesign_label', 'parts_ready_label', 'discord_webhook_url', 'discord_notify_enabled', 'site_base_url', 'url_copy_extra'])
  ]);
  catalogOptions = optionsRes.data || [];
  const settingsMap = Object.fromEntries((settingsRes.data || []).map((row) => [row.key, row.value]));
  catalogFees.illustration = Number(settingsMap.illustration_price_min || 0);
  catalogFees.chardesign = Number(settingsMap.chardesign_price_min || 0);
  scopeLabels.illustration = settingsMap.illustration_label || 'イラスト制作';
  scopeLabels.chardesign = settingsMap.chardesign_label || 'キャラクターデザイン';
  scopeLabels.partsReady = settingsMap.parts_ready_label || 'パーツ分け済みイラスト';
  discordSettings.url = settingsMap.discord_webhook_url || '';
  discordSettings.enabled = String(settingsMap.discord_notify_enabled ?? true) !== 'false';
  siteBaseUrl = (settingsMap.site_base_url || '').replace(/\/+$/, '');
  urlCopyExtraRaw = settingsMap.url_copy_extra || '';
  renderUrlCopyList();
  document.querySelectorAll('[data-illust-label]').forEach((el) => { el.textContent = scopeLabels.illustration; });
  document.querySelectorAll('[data-chardes-label]').forEach((el) => { el.textContent = scopeLabels.chardesign; });
  document.querySelectorAll('[data-parts-ready-label]').forEach((el) => { el.textContent = scopeLabels.partsReady; });
}

/* ===== 追加機能：ステータス変更時のDiscord通知 ===== */
let discordSettings = { url: '', enabled: true };
const DISCORD_NOTIFY_STATUSES = new Set(['delivered', 'completed']);
async function notifyDiscordStatusChange(item, newStatus) {
  if (!discordSettings.url || !discordSettings.enabled || !DISCORD_NOTIFY_STATUSES.has(newStatus)) return;
  const label = STATUS[newStatus]?.label || newStatus;
  const content = `🔔 ステータスが更新されました\n依頼者：${item.request_name}\nシリアル：${item.serial}\n新しいステータス：${label}`;
  try {
    await fetch(discordSettings.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
  } catch (error) { /* 通知失敗は無視（保存自体は成功している） */ }
}

function catalogSelectOptions() {
  return [
    { id: '__illustration', name: scopeLabels.illustration, fee: catalogFees.illustration, quote: false, kind: 'illustration' },
    { id: '__chardesign', name: scopeLabels.chardesign, fee: catalogFees.chardesign, quote: false, kind: 'chardesign' },
    ...catalogOptions.map((opt) => ({ id: `opt-${opt.id}`, name: opt.name, fee: Number(opt.price || 0), quote: opt.price === null || opt.price === undefined, kind: 'option' }))
  ];
}

function fillCatalogSelect() {
  const select = $('#od-catalog-select');
  if (!select) return;
  const list = catalogSelectOptions();
  select.innerHTML = list.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}${item.quote ? '（要お見積り）' : `（${yen(item.fee)}〜）`}</option>`).join('');
}

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function daysUntil(dateStr) { if (!dateStr) return null; return Math.floor((new Date(`${dateStr}T00:00:00`) - new Date(`${todayStr()}T00:00:00`)) / 86400000); }
function fmtDate(dateStr) { if (!dateStr) return '未設定'; const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`); return `${d.getMonth() + 1}月${d.getDate()}日`; }

function dueInfo(item) {
  const days = daysUntil(String(item.due_date || '').slice(0, 10));
  if (days === null) return { level: 'none', label: '納期未設定' };
  if (days < 0) return { level: 'overdue', label: `納期超過（${Math.abs(days)}日）` };
  if (days === 0) return { level: 'today', label: '本日納期！' };
  if (days <= 3) return { level: 'soon', label: `期限間近（あと${days}日）` };
  if (days === 1) return { level: 'soon', label: '明日が納期！' };
  return { level: 'ok', label: `あと${days}日` };
}

function progressInfo(item) {
  const done = stepsOf(item).length;
  const total = stepsForItem(item).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

function revisionOver(item) { return Number(item.revision_used || 0) > Number(item.revision_limit || 0); }

function awaitingTooLong(item) {
  if (orderStatusOf(item) !== 'awaiting' || !item.awaiting_since) return false;
  const days = daysUntil(String(item.awaiting_since).slice(0, 10));
  return days !== null && days <= -7;
}

function stalled(item) {
  if (!isActive(item) || ['working', 'prep', 'revising'].indexOf(orderStatusOf(item)) === -1) return false;
  const created = item.created_date ? new Date(item.created_date) : null;
  return created && (Date.now() - created.getTime()) > 45 * 86400000;
}

function scopeTags(item) {
  const tags = [];
  if (item.confirmation_agreed_at) tags.push({ label: `✓ 同意済み（${fmtDate(item.confirmation_agreed_at)}）`, cls: 'scope-agreed' });
  if (item.plan) tags.push({ label: item.plan, cls: 'scope-plan' });
  if (item.motion) tags.push({ label: item.motion, cls: 'scope-motion' });
  tags.push(scopeYesNoTag(scopeLabels.illustration, item.illustration_needed));
  tags.push(scopeYesNoTag(scopeLabels.chardesign, item.chardesign_needed));
  if (item.parts_illustration_ready === true) tags.push({ label: `${scopeLabels.partsReady}：あり`, cls: 'scope-yes' });
  if (item.parts_illustration_ready === false) tags.push({ label: `${scopeLabels.partsReady}：なし`, cls: 'scope-no' });
  if (item.options) tags.push({ label: `オプション：${item.options}`, cls: 'scope-option' });
  return tags;
}
function scopeYesNoTag(label, value) {
  if (value === true) return { label: `${label}：必要`, cls: 'scope-yes' };
  if (value === false) return { label: `${label}：不要（支給あり）`, cls: 'scope-no' };
  return { label: `${label}：不明（旧フォームの相談）`, cls: 'scope-unknown' };
}
function scopeTagsHtml(item) { return scopeTags(item).map((tag) => `<span class="scope-tag ${tag.cls}">${escapeHtml(tag.label)}</span>`).join(''); }

function contactSummary(item) {
  const method = item.contact_method || 'email';
  if (method === 'x') return `X（DM）：${item.contact_id || 'ID未登録'}`;
  if (method === 'discord') return `Discord：${item.contact_id || 'ユーザー名未登録'}`;
  return `✉ ${item.email || item.contact_id || 'メール未登録'}`;
}

function contactRow(item) {
  const method = item.contact_method || 'email';
  if (method === 'x') {
    const handle = String(item.contact_id || '').replace(/^@+/, '');
    const profileHref = handle ? `https://x.com/${handle}` : '';
    return `<span class="contact-email">X（DM）：${item.contact_id ? escapeHtml(item.contact_id) : 'ID未登録'}</span>
      <div class="contact-actions">
        <a class="x-button" href="https://x.com/Qinopy0104" target="_blank" rel="noopener">ぴのきー。のXを開く <span>→</span></a>
        ${profileHref ? `<a class="x-button ghost" href="${profileHref}" target="_blank" rel="noopener">お客様のXを開く <span>→</span></a>` : ''}
      </div>`;
  }
  if (method === 'discord') {
    return `<span class="contact-email">Discord：${item.contact_id ? escapeHtml(item.contact_id) : 'ユーザー名未登録'}</span>
      <div class="contact-actions"><span class="discord-note">うちのDiscordは <b>kinopi_0104</b> ／ 会話したい人は追加お願いします</span></div>`;
  }
  if (!item.email && !item.contact_id) return `<span class="contact-email">メールアドレス未登録</span>`;
  const address = item.email || item.contact_id;
  const subject = encodeURIComponent(`【ぴのきー。】${item.serial} のご相談について`);
  const body = encodeURIComponent(`${item.request_name} 様\n\nお問い合わせいただきありがとうございます。\nシリアルナンバー：${item.serial}\n\n`);
  return `<span class="contact-email">✉ ${escapeHtml(address)}</span>
    <div class="contact-actions"><a class="mail-button" href="mailto:${encodeURIComponent(address)}?subject=${subject}&body=${body}">メールを送る <span>→</span></a></div>`;
}

function buildPlanFilter() {
  const select = $('#plan-filter');
  if (!select) return;
  const plans = [...new Set(inquiries.map((item) => (item.plan || '').trim()).filter(Boolean))];
  const hasNone = inquiries.some((item) => !(item.plan || '').trim());
  select.innerHTML = '<option value="all">プラン：すべて</option>' + plans.map((plan) => `<option value="${escapeHtml(plan)}">${escapeHtml(plan)}</option>`).join('') + (hasNone ? '<option value="__none__">プラン未設定</option>' : '');
  select.value = (planFilter === 'all' || plans.includes(planFilter) || (planFilter === '__none__' && hasNone)) ? planFilter : 'all';
  planFilter = select.value;
}

function updateCounts() {
  buildPlanFilter();
  const count = (predicate) => inquiries.filter(predicate).length;
  $('#count-all').textContent = inquiries.length;
  $('#count-pending').textContent = count((item) => !item.replied);
  $('#count-done').textContent = count((item) => item.replied);
}

function matchesSearch(item, term) {
  if (!term) return true;
  const haystack = `${item.serial} ${item.request_name} ${item.email || ''} ${item.contact_id || ''} ${item.message || ''} ${item.plan || ''} ${item.motion || ''} ${item.options || ''}`.toLowerCase();
  return haystack.includes(term);
}

function passesFilters(item) {
  if (currentFilter === 'pending' && item.replied) return false;
  if (currentFilter === 'done' && !item.replied) return false;
  if (statusFilter !== 'all') {
    if (statusFilter.startsWith('d:')) { if (displayStatusKey(item) !== statusFilter.slice(2)) return false; }
    else if (orderStatusOf(item) !== statusFilter) return false;
  }
  if (planFilter !== 'all') {
    if (planFilter === '__none__') { if (item.plan) return false; }
    else if ((item.plan || '') !== planFilter) return false;
  }
  if (paymentFilter !== 'all' && paymentOf(item) !== paymentFilter) return false;
  const level = dueInfo(item).level;
  if (dueFilter === 'overdue' && !(level === 'overdue' && isActive(item))) return false;
  if (dueFilter === 'week') { const days = daysUntil(String(item.due_date || '').slice(0, 10)); if (!(isActive(item) && (level === 'overdue' || level === 'today' || (days !== null && days >= 0 && days <= 7)))) return false; }
  if (dueFilter === 'none' && level !== 'none') return false;
  return true;
}

let openCardIds = new Set();

let currentSort = 'new';

function sortInquiries(list) {
  const sorted = list.slice();
  if (currentSort === 'old') return sorted.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  if (currentSort === 'due') return sorted.sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });
  if (currentSort === 'attention') return sorted.sort((a, b) => {
    const diff = attentionReasons(b).length - attentionReasons(a).length;
    if (diff !== 0) return diff;
    return new Date(b.created_date) - new Date(a.created_date);
  });
  if (currentSort === 'unpaid') return sorted.sort((a, b) => {
    const aUnpaid = a.payment_status !== 'paid' ? 0 : 1;
    const bUnpaid = b.payment_status !== 'paid' ? 0 : 1;
    if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid;
    return new Date(b.created_date) - new Date(a.created_date);
  });
  return sorted.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
}

function renderList() {
  const list = $('#inquiries-admin-list');
  const term = currentSearch.trim().toLowerCase();
  const filtered = sortInquiries(inquiries.filter((item) => passesFilters(item) && matchesSearch(item, term)));
  if (!filtered.length) { list.innerHTML = '<p class="empty-text">条件に合う依頼がありません。</p>'; return; }
  list.innerHTML = filtered.map((item) => {
    const status = orderStatusOf(item);
    const st = STATUS[status];
    const pay = PAYMENT[paymentOf(item)];
    const due = dueInfo(item);
    const ds = displayStatusOf(item);
    const reasons = attentionReasons(item);
    const isEditing = editingId === item.id;
    const priceText = Number(item.total || 0) > 0 ? `${Number(item.total).toLocaleString('ja-JP')}円` : '要お見積り';
    const dueText = item.due_date ? `${fmtDate(item.due_date)}（${due.label}）` : '未設定';
    const revText = `${item.revision_used || 0} / ${item.revision_limit ?? 2}回`;
    const illustCount = illustFormCounts[item.serial] || 0;
    const illustBanner = illustCount ? `<button type="button" class="illustform-banner" data-open-detail="${item.id}" data-open-tab="illustform">📋 依頼票 ${illustCount}件届いています <span>今すぐ確認する →</span></button>` : '';
    const keyInfo = isEditing
      ? `<div class="inquiry-edit-form" data-id="${item.id}">
          <label>プラン<input data-field="plan" value="${escapeHtml(item.plan || '')}" /></label>
          <label>可動域<input data-field="motion" value="${escapeHtml(item.motion || '')}" /></label>
          <label>オプション<input data-field="options" value="${escapeHtml(item.options || '')}" /></label>
          <label>お支払い目安（円）<input data-field="total" type="number" min="0" value="${Number(item.total || 0)}" /></label>
          <div class="edit-actions"><button class="save-edit-button" data-id="${item.id}">保存する</button><button class="cancel-edit-button">閉じる</button></div>
        </div>`
      : `<dl class="ic-grid">
          <div><dt>プラン</dt><dd>${escapeHtml(item.plan || '未設定')}</dd></div>
          <div><dt>可動域</dt><dd>${escapeHtml(item.motion || '未設定')}</dd></div>
          <div><dt>料金</dt><dd class="ic-price">${priceText}</dd></div>
          <div><dt>納期</dt><dd class="is-${due.level}">${dueText}</dd></div>
          <div><dt>修正</dt><dd class="${revisionOver(item) ? 'is-over' : ''}">${revText}</dd></div>
          <div><dt>入金</dt><dd><span class="payment-badge ${pay.cls}">${pay.label}</span></dd></div>
        </dl>`;
    return `<article class="inquiry-card ${st.cls} ${ds.cls} ${reasons.length ? 'is-attention' : ''}" data-id="${item.id}">
      <div class="ic-head">
        <div class="ic-title-block">
          <h3 class="ic-name">${escapeHtml(item.request_name)}</h3>
          <div class="ic-sub">
            <span class="serial-tag">${escapeHtml(item.serial)}</span>
            <button type="button" class="serial-copy-button" data-copy-text="${escapeHtml(item.serial)}" title="コードをコピー">コピー</button>
            <span class="ic-date">受付：${item.created_date ? new Date(item.created_date).toLocaleString('ja-JP') : '—'}</span>
          </div>
        </div>
        <div class="ic-status-block">
          <span class="ds-badge ${ds.cls}"><i>${ds.mark}</i>${ds.label}</span>
          <span class="ic-raw-status">${st.label}</span>
        </div>
      </div>
      ${reasons.length ? `<p class="ic-attn"><b>要対応</b>${reasons.map(escapeHtml).join('・')}</p>` : ''}
      ${illustBanner}
      ${keyInfo}
      <div class="ic-actions">
        <button class="detail-button" data-action="detail" data-id="${item.id}">詳細を見る <span>→</span></button>
        <button class="reply-toggle-button" data-action="toggle-reply" data-id="${item.id}" data-replied="${item.replied}">${item.replied ? '未返信に戻す' : '返信済みにする'}</button>
        <div class="ic-more">
          <button type="button" class="ic-more-button" data-more-toggle aria-label="その他の操作" aria-expanded="false">︙</button>
          <div class="ic-more-menu" hidden>
            <button type="button" class="edit-button" data-action="edit" data-id="${item.id}">${isEditing ? '編集を閉じる' : '内容を編集'}</button>
            <button type="button" class="delete-button" data-action="delete" data-id="${item.id}">削除</button>
          </div>
        </div>
      </div>
    </article>`;
  }).join('');
}

function buildTaskList() {
  const tasks = [];
  inquiries.forEach((item) => {
    const due = dueInfo(item);
    if (!isActive(item)) return;
    const illustCount = illustFormCounts[item.serial] || 0;
    if (illustCount) tasks.push({ item, pri: -1, icon: '📋', text: `依頼票が届いています：${item.request_name}（${illustCount}件）`, tab: 'illustform' });
    if (due.level === 'overdue') tasks.push({ item, pri: 0, icon: '🚨', text: `納期超過：${item.request_name}（${due.label}）` });
    else if (due.level === 'today') tasks.push({ item, pri: 1, icon: '⏰', text: `本日納期：${item.request_name}` });
    else if (due.level === 'soon' && daysUntil(String(item.due_date || '').slice(0, 10)) === 1) tasks.push({ item, pri: 2, icon: '⏰', text: `明日が納期：${item.request_name}` });
    if (orderStatusOf(item) === 'awaiting') tasks.push({ item, pri: 3, icon: '💬', text: awaitingTooLong(item) ? `クライアント確認待ち：${item.request_name}（⚠長期間返信なし）` : `クライアント確認待ち：${item.request_name}` });
    if (!item.replied && orderStatusOf(item) === 'received') tasks.push({ item, pri: 4, icon: '✉', text: `未返信の相談：${item.request_name}` });
    if (['unpaid', 'wait'].includes(paymentOf(item)) && orderStatusOf(item) !== 'received') tasks.push({ item, pri: 5, icon: '💰', text: `未入金：${item.request_name}` });
    if (revisionOver(item)) tasks.push({ item, pri: 6, icon: '🔁', text: `無料修正回数超過：${item.request_name}` });
    if (stalled(item)) tasks.push({ item, pri: 7, icon: '🛑', text: `制作が長期間止まっています：${item.request_name}` });
  });
  return tasks.sort((a, b) => a.pri - b.pri).slice(0, 10);
}

function renderAlerts() {
  const strip = $('#alert-strip');
  const chips = [];
  const count = (predicate) => inquiries.filter(predicate).length;
  const overdue = count((item) => isActive(item) && dueInfo(item).level === 'overdue');
  const today = count((item) => isActive(item) && dueInfo(item).level === 'today');
  const tomorrow = count((item) => isActive(item) && daysUntil(String(item.due_date || '').slice(0, 10)) === 1);
  const awaiting = count((item) => orderStatusOf(item) === 'awaiting');
  const unpaid = count((item) => !['completed', 'cancelled'].includes(orderStatusOf(item)) && ['unpaid', 'wait'].includes(paymentOf(item)));
  const revOver = count((item) => isActive(item) && revisionOver(item));
  const unread = count((item) => !item.replied);
  if (overdue) chips.push(`⚠ 納期超過の依頼が${overdue}件`);
  if (today) chips.push(`⚠ 本日が納期の依頼が${today}件`);
  if (tomorrow) chips.push(`⚠ 明日が納期の依頼が${tomorrow}件`);
  if (awaiting) chips.push(`⚠ クライアント確認待ちが${awaiting}件`);
  if (unpaid) chips.push(`⚠ 未入金の依頼が${unpaid}件`);
  if (revOver) chips.push(`⚠ 無料修正回数を超えている依頼が${revOver}件`);
  if (unread) chips.push(`✉ 未返信の相談が${unread}件`);
  strip.hidden = chips.length === 0;
  strip.innerHTML = chips.map((text) => `<span class="alert-chip">${text}</span>`).join('');
}

function renderTodayTasks() {
  const box = $('#today-tasks');
  const tasks = buildTaskList();
  if (!tasks.length) { box.innerHTML = '<li class="dash-empty">やるべきことはありません ♡ ゆっくり休もう</li>'; return; }
  box.innerHTML = tasks.map((task) => `<li><button data-open-detail="${task.item.id}" ${task.tab ? `data-open-tab="${task.tab}"` : ''}><span>${task.icon}</span><b>${escapeHtml(task.text)}</b><small>${escapeHtml(task.item.serial)} <i>→</i></small></button></li>`).join('');
}

function renderSales() {
  const now = new Date();
  const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const thisMonth = monthKey(now);
  const active = inquiries.filter((item) => !['cancelled'].includes(orderStatusOf(item)));
  const paidThisMonth = inquiries.filter((item) => item.paid_date && String(item.paid_date).slice(0, 7) === thisMonth).reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
  const planned = active.filter((item) => !['completed'].includes(orderStatusOf(item))).reduce((sum, item) => sum + Number(item.total || 0), 0);
  const countBy = (predicate) => active.filter(predicate).length;
  const tiles = [
    { label: '今月の売上', value: yen(paidThisMonth), cls: 'tile-money' },
    { label: '売上予定額', value: yen(planned), cls: 'tile-plan' },
    { label: '今月の依頼数', value: `${countBy((item) => item.created_date && monthKey(new Date(item.created_date)) === thisMonth)}件`, cls: '' },
    { label: '未返信', value: `${countBy((item) => !item.replied)}件`, cls: 'tile-wait' },
    { label: '制作中', value: `${countBy((item) => ['prep', 'working', 'revising'].includes(orderStatusOf(item)))}件`, cls: 'tile-working' },
    { label: '確認待ち', value: `${countBy((item) => orderStatusOf(item) === 'awaiting')}件`, cls: 'tile-wait' },
    { label: '完了', value: `${countBy((item) => orderStatusOf(item) === 'completed')}件`, cls: 'tile-done' },
    { label: '未入金', value: `${countBy((item) => ['unpaid', 'wait'].includes(paymentOf(item)))}件`, cls: 'tile-unpaid' }
  ];
  $('#sales-tiles').innerHTML = tiles.map((tile) => `<div class="sales-tile ${tile.cls}"><small>${tile.label}</small><b>${tile.value}</b></div>`).join('');
  const months = [];
  for (let i = 5; i >= 0; i -= 1) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ key: monthKey(d), label: `${d.getMonth() + 1}月` }); }
  const sums = months.map((m) => inquiries.filter((item) => item.paid_date && String(item.paid_date).slice(0, 7) === m.key).reduce((sum, item) => sum + Number(item.paid_amount || 0), 0));
  const max = Math.max(...sums, 1);
  $('#sales-chart').innerHTML = months.map((m, index) => `<div class="chart-col"><i style="height:${Math.max((sums[index] / max) * 100, 3)}%"></i><small>${m.label}</small><b>${sums[index] ? yen(sums[index]) : '—'}</b></div>`).join('');
}

let illustFormCounts = {};
async function loadIllustFormCounts() {
  const { data, error } = await db.from('illustration_requests').select('serial,viewed').eq('viewed', false);
  if (error) {
    // viewed 列が無い環境（illustform-viewed.sql 未実行）でも、届いた件数だけは分かるようにする
    const fallback = await db.from('illustration_requests').select('serial');
    illustFormCounts = {};
    (fallback.data || []).forEach((row) => { illustFormCounts[row.serial] = (illustFormCounts[row.serial] || 0) + 1; });
    return;
  }
  illustFormCounts = {};
  (data || []).forEach((row) => { illustFormCounts[row.serial] = (illustFormCounts[row.serial] || 0) + 1; });
}

function renderDashboard() { renderAlerts(); renderTodayTasks(); renderSales(); renderCalendar(); }

async function loadInquiries() {
  const { data, error } = await db.from('inquiries').select('*').order('created_date', { ascending: false });
  if (error) { $('#inquiries-admin-list').innerHTML = `<p class="empty-text">読み込めませんでした：${error.message}</p>`; return; }
  inquiries = data || [];
  updateCounts();
  renderDashboard();
  renderList();
  await Promise.all([loadCatalog(), loadMessageTemplates(), loadExpressionCatalog(), loadIllustFormCounts()]);
  renderList();
}

/* ===== まだ作られていない列があっても保存できるようにする仕組み ===== */
const missingColumns = new Set();

const COLUMN_SQL_FILE = {
  email: 'inquiries-status-columns.sql', replied: 'inquiries-status-columns.sql', memo: 'inquiries-status-columns.sql',
  contact_method: 'inquiries-contact-status.sql', contact_id: 'inquiries-contact-status.sql', cancelled: 'inquiries-contact-status.sql',
  order_status: 'order-management.sql', due_date: 'order-management.sql', base_amount: 'order-management.sql', extra_items: 'order-management.sql',
  revision_limit: 'order-management.sql', revision_used: 'order-management.sql', payment_status: 'order-management.sql', paid_amount: 'order-management.sql',
  paid_date: 'order-management.sql', progress_steps: 'order-management.sql', spec: 'order-management.sql', files: 'order-management.sql', awaiting_since: 'order-management.sql',
  related_inquiry_id: 'process-management.sql', related_task_id: 'process-management.sql', consult_status: 'process-management.sql', extra_fee: 'process-management.sql', extra_count: 'process-management.sql',
  illustration_needed: 'request-scope.sql', chardesign_needed: 'request-scope.sql', expressions_needed: 'expression-catalog.sql', parts_illustration_ready: 'parts-illustration-ready.sql',
  confirmation_agreed_at: 'order-confirmation.sql', confirmation_snapshot: 'order-confirmation.sql',
  revision_extra_fee: 'revision-hearing-summary.sql', hearing_summary: 'revision-hearing-summary.sql', payment_method: 'revision-hearing-summary.sql'
};

function missingColumnName(text) {
  const message = String(text || '');
  const patterns = [
    /Could not find the '([a-zA-Z0-9_]+)' columns? of/i,
    /column "?([a-zA-Z0-9_]+)"? of relation/i,
    /column ([a-zA-Z0-9_]+) does not exist/i
  ];
  for (const pattern of patterns) { const found = pattern.exec(message); if (found) return found[1]; }
  return '';
}

function showColumnNotice() {
  let strip = $('#column-notice');
  if (!strip) {
    strip = document.createElement('div');
    strip.id = 'column-notice';
    strip.className = 'column-notice';
    document.body.appendChild(strip);
    strip.addEventListener('click', (event) => { if (event.target.closest('[data-close-notice]')) strip.remove(); });
  }
  const files = [...new Set([...missingColumns].map((name) => COLUMN_SQL_FILE[name] || 'order-management.sql'))];
  strip.innerHTML = `<b>♡ 一部の項目はまだ保存されません</b><p>${[...missingColumns].map((name) => `<code>${name}</code>`).join('、')} の列がデータベースにありません。ほかの項目は保存できています。</p><p>SupabaseのSQL Editorで ${files.map((f) => `<code>supabase/${f}</code>`).join(' と ')} を実行すると、すべて保存できるようになります。</p><button type="button" data-close-notice>閉じる ×</button>`;
}

async function updateInquiry(id, patch, depth = 0) {
  const payload = { ...patch };
  missingColumns.forEach((name) => delete payload[name]);
  if (!Object.keys(payload).length) { showColumnNotice(); return payload; }
  const { error } = await db.from('inquiries').update(payload).eq('id', id);
  if (!error) return payload;
  const column = missingColumnName(error.message);
  if (column && depth < 20) {
    missingColumns.add(column);
    showColumnNotice();
    return updateInquiry(id, patch, depth + 1);
  }
  const hint = /schema cache|column/i.test(error.message) ? '（新しい列が必要です。supabase/order-management.sql をSupabaseのSQL Editorで実行してください）' : '';
  alert(`更新できませんでした：${error.message}${hint}`);
  return false;
}

async function refreshItem(id, patch) {
  const applied = await updateInquiry(id, patch);
  if (!applied) return false;
  const item = inquiries.find((entry) => String(entry.id) === String(id));
  if (item) Object.assign(item, applied);
  updateCounts();
  renderDashboard();
  renderList();
  return true;
}

function buildSelectOptions() {
  const statusSelect = $('#status-filter');
  statusSelect.innerHTML = '<option value="all">ステータス：すべて</option>'
    + '<optgroup label="進行状況">' + Object.entries(DISPLAY_STATUS).map(([key, ds]) => `<option value="d:${key}">${ds.label}</option>`).join('') + '</optgroup>'
    + '<optgroup label="詳細ステータス">' + Object.entries(STATUS).map(([key, st]) => `<option value="${key}">${st.label}</option>`).join('') + '</optgroup>';
  const paymentSelect = $('#payment-filter');
  paymentSelect.innerHTML = '<option value="all">支払い：すべて</option>' + Object.entries(PAYMENT).map(([key, pay]) => `<option value="${key}">${pay.label}</option>`).join('');
  $('#od-status').innerHTML = Object.entries(STATUS).map(([key, st]) => `<option value="${key}">${st.label}</option>`).join('');
  $('#od-payment').innerHTML = Object.entries(PAYMENT).map(([key, pay]) => `<option value="${key}">${pay.label}</option>`).join('');
  $('#order-file-kind').innerHTML = FILE_KINDS.map((kind) => `<option value="${kind.id}">${kind.label}</option>`).join('');
}

function fillStaticBoxes() {
  // 進捗チェックリストは依頼ごとに内容が変わるため（イラスト・キャラデザ・表情の有無で増減）、
  // ここでは静的に描画せず、openDetail() のたびに refreshProgressBox() で描き直します。
}

function currentDetailItem() { return inquiries.find((entry) => String(entry.id) === String(detailId)); }

function refreshProgressBox(item) {
  const steps = stepsForItem(item);
  const doneIds = stepsOf(item);
  $('#od-progress-box').innerHTML = steps.map((step) => `<label class="od-step"><input type="checkbox" data-step="${escapeHtml(step.id)}" ${doneIds.includes(step.id) ? 'checked' : ''} /><span>${escapeHtml(step.label)}</span></label>`).join('');
  const percent = steps.length ? Math.round((doneIds.length / steps.length) * 100) : 0;
  $('#od-progress-count').textContent = `${doneIds.length} / ${steps.length} 完了`;
  $('#od-progress-rate').textContent = `${percent}%`;
  $('#od-progress-fill').style.width = `${percent}%`;
}

function refreshExpressionBox(item) {
  const box = $('#od-expr-box');
  if (!box) return;
  const selected = exprOf(item);
  box.innerHTML = expressionCatalog.map((name) => `<label class="od-step"><input type="checkbox" data-expr="${escapeHtml(name)}" ${selected.includes(name) ? 'checked' : ''} /><span>${escapeHtml(name)}</span></label>`).join('') || '<p class="od-hint">まだ表情の種類が登録されていません。「表情の種類を編集」から追加できます。</p>';
  $('#od-expr-count').textContent = `選択中：${selected.length}種類${selected.length ? '（' + selected.join('、') + '）' : ''}`;
}

function renderExtraRows(item) {
  const rows = extrasOf(item);
  $('#od-extra-items').innerHTML = rows.map((extra, index) => `<div class="extra-row"><input class="extra-label" data-extra="${index}" value="${escapeHtml(extra.label || '')}" placeholder="項目名（例：追加表情2個）" /><input class="extra-fee" data-extra-fee="${index}" type="number" min="0" value="${Number(extra.fee || 0)}" /><button type="button" class="extra-remove" data-extra-remove="${index}">×</button></div>`).join('') || '<p class="od-hint">追加料金の項目がありません</p>';
  refreshTotalLine();
}

function readExtras() {
  const rows = [];
  document.querySelectorAll('#od-extra-items .extra-row').forEach((row) => {
    const label = row.querySelector('.extra-label').value.trim();
    const fee = Number(row.querySelector('.extra-fee').value || 0);
    if (label || fee) rows.push({ label, fee });
  });
  return rows;
}

function refreshTotalLine() {
  const base = Number($('#od-base').value || 0);
  const extras = readExtras();
  const total = base + extras.reduce((sum, extra) => sum + Number(extra.fee || 0), 0);
  $('#od-total').textContent = yen(total);
}

/* ===== 追加：詳細画面の「① 基本情報」サマリーと「⑤ 進捗」ステッパー ===== */
const STEPPER_STEPS = ['受付', 'ヒアリング', '料金確認', '同意', '制作中', '確認', '納品完了'];
const STEPPER_POSITION = { unreplied: [0, false], hearing: [1, false], pricewait: [2, false], agreewait: [3, false], agreed: [3, true], working: [4, false], reviewing: [5, false], delivered: [6, true], cancelled: [-1, false] };

function renderDetailSummary(item) {
  const box = $('#od-summary');
  if (!box || !item) return;
  // 画面上で変更中の値（ステータス・返信済み）を反映して表示する
  const draft = { ...item, order_status: $('#od-status')?.value || item.order_status, replied: $('#od-replied') ? $('#od-replied').checked : item.replied };
  const ds = displayStatusOf(draft);
  $('#od-sum-name').textContent = item.request_name || '';
  $('#od-sum-serial').textContent = `依頼番号：${item.serial}`;
  $('#od-sum-created').textContent = `受付：${item.created_date ? new Date(item.created_date).toLocaleString('ja-JP') : '—'}`;
  $('#od-sum-contact').textContent = contactSummary(item);
  const badge = $('#od-sum-ds');
  badge.className = `ds-badge ${ds.cls}`;
  badge.innerHTML = `<i>${ds.mark}</i>${ds.label}`;

  // 常に見えるヘッダー（名前・シリアル・受付日時・連絡先・大きなステータス）
  $('#od-name').textContent = item.request_name || '';
  $('#od-head-created').textContent = `受付：${item.created_date ? new Date(item.created_date).toLocaleString('ja-JP') : '—'}`;
  $('#od-head-contact').textContent = contactSummary(item);
  const headDs = $('#od-head-ds');
  if (headDs) { headDs.className = `ds-badge ds-badge-lg ${ds.cls}`; headDs.innerHTML = `<i>${ds.mark}</i>${ds.label}`; }
  const waiting = $('#od-head-waiting');
  if (waiting) waiting.textContent = NEXT_ACTION[ds.key]?.waiting || '';

  // 「次にやること」カード
  const next = NEXT_ACTION[ds.key] || NEXT_ACTION.hearing;
  const nextActionCard = $('#od-next-action');
  if (nextActionCard) nextActionCard.className = `od-next-action ${ds.cls}`;
  const nextBadge = $('#od-next-action-badge');
  if (nextBadge) { nextBadge.className = `od-next-action-badge ${ds.cls}`; nextBadge.innerHTML = `<i>${ds.mark}</i>${ds.label}`; }
  const nextText = $('#od-next-action-text');
  if (nextText) nextText.textContent = next.text;
  const nextButton = $('#od-next-action-button');
  if (nextButton) {
    if (next.link) { nextButton.href = `${next.link}?serial=${encodeURIComponent(item.serial)}`; nextButton.hidden = false; }
    else { nextButton.hidden = true; }
  }

  // ②プラン・料金カードの「合計金額」（お支払い金額と同じ値をここにも表示）
  const planTotalEcho = $('#od-plan-total-echo');
  if (planTotalEcho) planTotalEcho.textContent = yen(item.total);

  const [cur, curDone] = STEPPER_POSITION[ds.key] || [-1, false];
  $('#od-stepper').innerHTML = STEPPER_STEPS.map((label, i) => {
    const done = cur >= 0 && (i < cur || (i === cur && curDone));
    const current = i === cur && !curDone;
    return `<li class="${done ? 'is-done' : ''} ${current ? 'is-current' : ''}"><span class="od-step-dot">${done ? '✓' : i + 1}</span><b>${label}</b>${current ? '<em class="od-step-here">現在ここです</em>' : ''}</li>`;
  }).join('') + (ds.key === 'cancelled' ? '<li class="od-step-cancelled">この依頼はキャンセルされています</li>' : '');
  const statusLink = $('#od-link-status');
  const confirmLink = $('#od-link-confirm');
  if (statusLink) statusLink.href = `status.html?serial=${encodeURIComponent(item.serial)}`;
  if (confirmLink) confirmLink.href = `order-confirmation.html?serial=${encodeURIComponent(item.serial)}`;
}

function refreshRepliedBadge(item) {
  renderDetailSummary(item);
  const el = $('#od-replied-badge');
  if (!el) return;
  const on = $('#od-replied').checked;
  el.textContent = on ? '返信済み ♡' : '未返信';
  el.className = `reply-badge ${on ? 'is-done' : 'is-pending'}`;
}

async function renderIllustFormPanel(item) {
  const box = $('#od-illustform-box');
  if (!box) return;
  box.innerHTML = '<p class="od-hint">読み込み中…</p>';
  const { data, error } = await db.from('illustration_requests').select('*').eq('serial', item.serial).order('created_date', { ascending: false });
  if (error) { box.innerHTML = `<p class="od-hint">まだこの機能は使えません（${error.message.includes('does not exist') ? 'supabase/illustration-request.sql と supabase/parts-request.sql を実行してください' : error.message}）</p>`; return; }
  if (!data || !data.length) { box.innerHTML = '<p class="od-hint">まだ回答が届いていません。</p>'; return; }
  await getRequestFormLabel(''); // ラベルのキャッシュを先に読み込んでおく
  box.innerHTML = data.map((entry) => {
    const rows = Object.entries(entry.answers || {}).filter(([, value]) => value && (!Array.isArray(value) || value.length)).map(([label, value]) => {
      const content = Array.isArray(value)
        ? `<div class="illustform-image-row">${value.map((url) => {
            const fileName = decodeURIComponent(url.split('/').pop() || '');
            const isPsd = /\.psd$/i.test(fileName);
            return isPsd
              ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="illustform-file-badge">📄 ${escapeHtml(fileName.replace(/^\d+-[a-z0-9]+-/i, ''))}</a>`
              : `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="" /></a>`;
          }).join('')}</div>`
        : escapeHtml(value).replace(/\n/g, '<br>');
      return `<div class="illustform-row"><b>${escapeHtml(label)}</b><span>${content}</span></div>`;
    }).join('') || '<p class="od-hint">回答内容が空でした。</p>';
    const kindLabel = requestFormLabels[entry.form_type] || entry.form_type || 'イラスト制作';
    const isUnviewed = entry.viewed !== true;
    const statusBadge = isUnviewed ? '<span class="illustform-status is-new">● 未確認</span>' : '<span class="illustform-status is-done">✓ 確認済み</span>';
    const confirmButton = isUnviewed ? `<button type="button" class="illustform-confirm-button" data-illustform-confirm="${entry.id}">確認しました <span>✓</span></button>` : '<span class="illustform-done-label">✓ 確認済み</span>';
    return `<div class="illustform-entry ${isUnviewed ? 'is-unviewed' : 'is-viewed'}">
      <div class="illustform-entry-head">
        <div class="illustform-entry-meta"><span class="illustform-kind">${kindLabel}</span>${statusBadge}<span class="illustform-date">${new Date(entry.created_date).toLocaleString('ja-JP')} に回答</span></div>
        ${confirmButton}
      </div>
      <div class="illustform-rows">${rows}</div>
    </div>`;
  }).join('');
}

async function confirmIllustFormEntry(id, buttonEl) {
  const entryEl = buttonEl?.closest('.illustform-entry');
  // 押した瞬間に見た目を切り替える（保存を待たず、すぐ反応が分かるように）
  if (entryEl) {
    entryEl.classList.add('is-confirming');
    entryEl.classList.remove('is-unviewed');
    entryEl.classList.add('is-viewed');
    const statusEl = entryEl.querySelector('.illustform-status');
    if (statusEl) { statusEl.textContent = '✓ 確認済み'; statusEl.classList.remove('is-new'); statusEl.classList.add('is-done'); }
    buttonEl.outerHTML = '<span class="illustform-done-label">✓ 確認済み</span>';
  }
  const { data: updated, error } = await db.from('illustration_requests').update({ viewed: true }).eq('id', id).select();
  if (error) {
    const hint = /viewed/i.test(error.message) ? '（supabase/illustform-viewed.sql をSupabaseのSQL Editorで実行してください）' : '';
    alert(`確認済みにできませんでした：${error.message}${hint}`);
    const item = currentDetailItem();
    if (item) renderIllustFormPanel(item); // 失敗したので元の状態に戻す
    return;
  }
  if (!updated || !updated.length) {
    // RLS（権限設定）で更新が許可されず、エラーは出ないまま何も保存されていないケース
    alert('確認済みにできませんでした：更新の権限が設定されていない可能性があります（supabase/illustform-update-policy.sql をSupabaseのSQL Editorで実行してください）');
    const item = currentDetailItem();
    if (item) renderIllustFormPanel(item);
    return;
  }
  if (entryEl) setTimeout(() => entryEl.classList.remove('is-confirming'), 500);
  await loadIllustFormCounts();
  renderTodayTasks();
  renderList();
}

function refreshCurrentStage(item) {
  renderDetailSummary(item);
  const el = $('#od-current-stage');
  if (!el) return;
  const key = item.cancelled ? 'cancelled' : (STATUS[$('#od-status').value] ? $('#od-status').value : 'received');
  el.textContent = STATUS[key]?.label || STATUS.received.label;
}

function refreshDueCountdown(item) {
  const el = $('#od-due-countdown');
  if (!el) return;
  const due = dueInfo({ ...item, due_date: $('#od-due').value || null });
  el.textContent = due.label;
  el.className = `due-pill is-${due.level}`;
}

function refreshRevBox(item) {
  const limit = Number($('#od-rev-limit').value || 0);
  const used = Number($('#od-rev-used').value || 0);
  const left = limit - used;
  $('#od-rev-left').textContent = left >= 0 ? `残り ${left}回` : `超過 ${Math.abs(left)}回`;
  $('#od-rev-warn').hidden = left >= 0;
}

function renderFileList(item) {
  const list = filesOf(item);
  $('#od-file-list').innerHTML = list.length ? list.map((file, index) => {
    const kind = FILE_KINDS.find((entry) => entry.id === file.kind);
    return `<div class="od-file-row"><span class="od-file-kind">${kind ? kind.label : 'その他'}</span><a href="${file.url}" target="_blank" rel="noopener">${escapeHtml(file.name || 'ファイル')}</a><small>${file.date || ''}</small><button type="button" class="od-file-remove" data-file-remove="${index}">×</button></div>`;
  }).join('') : '<p class="od-hint">ファイルはまだありません</p>';
}

function openDetail(id) {
  closePanelPopout();
  const item = inquiries.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  detailId = item.id;
  $('#od-serial').textContent = item.serial;
  $('#od-name').textContent = item.request_name;
  $('#od-scope-tags').innerHTML = scopeTagsHtml(item);
  $('#od-status').value = orderStatusOf(item);
  $('#od-created').textContent = item.created_date ? new Date(item.created_date).toLocaleDateString('ja-JP') : '—';
  $('#od-due').value = item.due_date ? String(item.due_date).slice(0, 10) : '';
  $('#od-message').value = item.message || '';
  $('#od-hearing-summary').value = item.hearing_summary || '';
  $('#od-replied').checked = Boolean(item.replied);
  $('#od-contact').textContent = contactSummary(item);
  $('#od-contact-actions').innerHTML = contactRow(item);
  refreshCurrentStage(item);
  refreshDueCountdown(item);
  refreshRepliedBadge(item);
  renderIllustFormPanel(item);
  $('#od-plan').value = item.plan || '';
  $('#od-motion').value = item.motion || '';
  $('#od-options').value = item.options || '';
  $('#od-illust-needed').checked = item.illustration_needed === true;
  $('#od-chardes-needed').checked = item.chardesign_needed === true;
  $('#od-parts-ready').checked = item.parts_illustration_ready === true;
  fillCatalogSelect();
  const extras = extrasOf(item);
  const baseAmount = Number(item.base_amount || 0) > 0 ? Number(item.base_amount) : Math.max(Number(item.total || 0) - extras.reduce((sum, extra) => sum + Number(extra.fee || 0), 0), 0);
  $('#od-base').value = baseAmount;
  $('#od-payment').value = paymentOf(item);
  const paymentMethodBadge = $('#od-payment-method');
  const paymentMethodLabels = { bank: '💳 銀行振込希望', paypay: '📱 PayPay希望' };
  if (item.payment_method && paymentMethodLabels[item.payment_method]) {
    paymentMethodBadge.textContent = paymentMethodLabels[item.payment_method];
    paymentMethodBadge.classList.remove('is-unselected');
  } else {
    paymentMethodBadge.textContent = '未選択（お客様がまだ選んでいません）';
    paymentMethodBadge.classList.add('is-unselected');
  }
  $('#od-paid-amount').value = Number(item.paid_amount || 0);
  $('#od-paid-date').value = item.paid_date ? String(item.paid_date).slice(0, 10) : '';
  $('#od-rev-limit').value = Number(item.revision_limit ?? 2);
  $('#od-rev-used').value = Number(item.revision_used || 0);
  $('#od-rev-extra-fee').value = Number(item.revision_extra_fee || 0);
  $('#od-memo').value = item.memo || '';
  refreshProgressBox(item);
  refreshExpressionBox(item);
  renderExtraRows(item);
  refreshRevBox(item);
  renderFileList(item);
  renderTemplatesPanel(item);
  $('#od-save-message').textContent = '';
  markDetailSaved();
  document.querySelectorAll('.od-tab').forEach((tab, index) => tab.classList.toggle('is-active', index === 0));
  document.querySelectorAll('.od-panel').forEach((panel, index) => panel.classList.toggle('is-open', index === 0));
  $('#order-detail').showModal();
}

async function saveDetail() {
  const item = currentDetailItem();
  if (!item) return;
  const status = $('#od-status').value;
  const patch = {
    order_status: status,
    due_date: $('#od-due').value || null,
    message: $('#od-message').value,
    hearing_summary: $('#od-hearing-summary').value,
    replied: $('#od-replied').checked,
    plan: $('#od-plan').value,
    motion: $('#od-motion').value,
    options: $('#od-options').value,
    illustration_needed: $('#od-illust-needed').checked,
    chardesign_needed: $('#od-chardes-needed').checked,
    parts_illustration_ready: $('#od-parts-ready').checked,
    base_amount: Number($('#od-base').value || 0),
    extra_items: readExtras(),
    payment_status: $('#od-payment').value,
    paid_amount: Number($('#od-paid-amount').value || 0),
    paid_date: $('#od-paid-date').value || null,
    revision_limit: Number($('#od-rev-limit').value || 0),
    revision_used: Number($('#od-rev-used').value || 0),
    revision_extra_fee: Number($('#od-rev-extra-fee').value || 0),
    expressions_needed: [...document.querySelectorAll('#od-expr-box [data-expr]:checked')].map((box) => box.dataset.expr),
    progress_steps: [...document.querySelectorAll('#od-progress-box [data-step]:checked')].map((box) => box.dataset.step),
    memo: $('#od-memo').value,
    awaiting_since: status === 'awaiting' ? (item.awaiting_since || todayStr()) : null
  };
  patch.total = patch.base_amount + patch.extra_items.reduce((sum, extra) => sum + Number(extra.fee || 0), 0);
  const previousStatus = orderStatusOf(item);
  if (!await refreshItem(item.id, patch)) return;
  if (previousStatus !== status) notifyDiscordStatusChange(item, status);
  markDetailSaved();
  $('#od-save-message').textContent = missingColumns.size ? '保存しました！（一部の項目はSQL実行後に保存されます）' : '保存しました！';
  $('#od-save-message').style.color = missingColumns.size ? '#d8622f' : '#579578';
  $('#order-detail').close();
}

async function uploadOrderFile() {
  const item = currentDetailItem();
  if (!item) return;
  const fileInput = $('#order-file-input');
  const file = fileInput.files[0];
  if (!file) return alert('ファイルを選んでください。');
  const kind = $('#order-file-kind').value;
  const safeName = `${item.serial}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  const { error } = await db.storage.from('portfolio-media').upload(safeName, file, { upsert: false });
  if (error) return alert(`アップロードできませんでした：${error.message}`);
  const url = db.storage.from('portfolio-media').getPublicUrl(safeName).data.publicUrl;
  item.files = [...filesOf(item), { name: file.name, kind, url, size: file.size, date: todayStr() }];
  if (await updateInquiry(item.id, { files: item.files })) renderFileList(item);
  fileInput.value = '';
}

/* ===== 追加機能：詳細画面の未保存インジケーター ===== */
['input', 'change'].forEach((evt) => {
  document.addEventListener(evt, (event) => {
    if (event.target.closest('.od-tracked')) markDetailDirty();
  });
});
/* ===== 追加機能：タブの中身を別画面（ポップアップ）で開く ===== */
let popoutOriginalPanel = null;

function openPanelPopout(tabKey, title) {
  const panel = document.getElementById(`panel-${tabKey}`);
  const mount = document.getElementById('panel-popout-mount');
  const dialog = document.getElementById('panel-popout');
  if (!panel || !mount || !dialog) return;
  popoutOriginalPanel = panel;
  panel.classList.add('is-open');
  mount.innerHTML = '';
  const heading = document.createElement('h2');
  heading.className = 'od-popout-title';
  heading.textContent = title;
  mount.appendChild(heading);
  mount.appendChild(panel);
  dialog.showModal();
}

function closePanelPopout() {
  const dialog = document.getElementById('panel-popout');
  if (dialog?.open) dialog.close(); // 'close' イベント側で、中身を元の場所へ戻す処理が走ります
  else if (popoutOriginalPanel) returnPanelHome();
}

function returnPanelHome() {
  if (!popoutOriginalPanel) return;
  const panels = document.querySelector('#order-detail .od-panels');
  if (panels) panels.appendChild(popoutOriginalPanel);
  popoutOriginalPanel.classList.remove('is-open');
  popoutOriginalPanel = null;
  document.getElementById('panel-basic')?.classList.add('is-open');
  document.querySelectorAll('.od-tab').forEach((entry) => entry.classList.toggle('is-active', entry.dataset.tab === 'basic'));
}

document.getElementById('panel-popout')?.addEventListener('close', returnPanelHome);
document.getElementById('order-detail')?.addEventListener('close', closePanelPopout);

document.addEventListener('click', async (event) => {
  const filterChip = event.target.closest('.filter-chip');
  if (filterChip) {
    currentFilter = filterChip.dataset.filter;
    document.querySelectorAll('.filter-chip').forEach((chip) => chip.classList.toggle('is-active', chip === filterChip));
    renderList();
    return;
  }
  const taskButton = event.target.closest('[data-open-detail]');
  if (taskButton) {
    openDetail(taskButton.dataset.openDetail);
    if (taskButton.dataset.openTab) {
      const tab = document.querySelector(`.od-tab[data-tab="${taskButton.dataset.openTab}"]`);
      if (tab) { document.querySelectorAll('.od-tab').forEach((entry) => entry.classList.toggle('is-active', entry === tab)); document.querySelectorAll('.od-panel').forEach((panel) => panel.classList.toggle('is-open', panel.id === `panel-${tab.dataset.tab}`)); }
    }
    return;
  }
  const gotoTabButton = event.target.closest('[data-goto-tab]');
  if (gotoTabButton) { document.querySelector(`.od-tab[data-tab="${gotoTabButton.dataset.gotoTab}"]`)?.click(); return; }
  const tab = event.target.closest('.od-tab');
  if (tab) {
    document.querySelectorAll('.od-tab').forEach((entry) => entry.classList.toggle('is-active', entry === tab));
    if (tab.dataset.tab === 'basic') {
      closePanelPopout();
      document.querySelectorAll('.od-panel').forEach((panel) => panel.classList.toggle('is-open', panel.id === 'panel-basic'));
    } else {
      openPanelPopout(tab.dataset.tab, tab.textContent.trim());
    }
    return;
  }
  if (event.target.closest('.od-close')) {
    const dialogEl = event.target.closest('dialog');
    if (dialogEl?.id === 'panel-popout') { closePanelPopout(); return; }
    dialogEl?.close();
    return;
  }
  if (event.target.closest('#od-save')) { saveDetail(); return; }
  if (event.target.closest('#od-catalog-add')) {
    const item = currentDetailItem();
    const select = $('#od-catalog-select');
    if (!item || !select) return;
    const chosen = catalogSelectOptions().find((entry) => entry.id === select.value);
    if (!chosen) return;
    item.extra_items = [...readExtras(), { label: chosen.name, fee: Number(chosen.fee || 0) }];
    if (chosen.kind === 'illustration') item.illustration_needed = true;
    if (chosen.kind === 'chardesign') item.chardesign_needed = true;
    $('#od-illust-needed').checked = Boolean(item.illustration_needed);
    $('#od-chardes-needed').checked = Boolean(item.chardesign_needed);
    $('#od-scope-tags').innerHTML = scopeTagsHtml(item);
    refreshProgressBox(item);
    renderExtraRows(item);
    refreshTotalLine();
    return;
  }
  if (event.target.closest('#od-extra-add')) {
    const item = currentDetailItem();
    if (item) { item.extra_items = [...readExtras(), { label: '', fee: 0 }]; renderExtraRows(item); }
    return;
  }
  const extraRemove = event.target.closest('[data-extra-remove]');
  if (extraRemove) {
    const item = currentDetailItem();
    if (item) { const rows = readExtras(); rows.splice(Number(extraRemove.dataset.extraRemove), 1); item.extra_items = rows; renderExtraRows(item); }
    return;
  }
  if (event.target.closest('#od-rev-add')) {
    $('#od-rev-used').value = Number($('#od-rev-used').value || 0) + 1;
    refreshRevBox();
    return;
  }
  if (event.target.closest('#order-file-upload')) { uploadOrderFile(); return; }
  const urlCopyButton = event.target.closest('[data-copy-url]');
  if (urlCopyButton) { copyUrlToClipboard(urlCopyButton.dataset.copyUrl, urlCopyButton); return; }
  if (event.target.closest('[data-edit-base-url]')) { editSiteBaseUrl(); return; }
  const extraEditButton = event.target.closest('[data-edit-extra-url]');
  if (extraEditButton) { editExtraUrl(Number(extraEditButton.dataset.editExtraUrl)); return; }
  if (event.target.id === 'url-copy-add') { addExtraUrl(); return; }
  const textCopyButton = event.target.closest('[data-copy-text]');
  if (textCopyButton) { event.preventDefault(); copyUrlToClipboard(textCopyButton.dataset.copyText, textCopyButton); return; }
  if (event.target.closest('#od-serial-copy')) { copyUrlToClipboard($('#od-serial').textContent, event.target.closest('#od-serial-copy')); return; }
  const tmplMove = event.target.closest('[data-tmpl-move]');
  if (tmplMove) { const [idx, dir] = tmplMove.dataset.tmplMove.split(':'); moveMessageTemplate(Number(idx), Number(dir)); return; }
  const tmplCopy = event.target.closest('[data-tmpl-copy]');
  if (tmplCopy) { const item = currentDetailItem(); if (item) copyTemplate(Number(tmplCopy.dataset.tmplCopy), item, tmplCopy); return; }
  const tmplEdit = event.target.closest('[data-tmpl-edit]');
  if (tmplEdit) { openTmplMsgDialog(Number(tmplEdit.dataset.tmplEdit)); return; }
  const illustConfirmButton = event.target.closest('[data-illustform-confirm]');
  if (illustConfirmButton) { confirmIllustFormEntry(illustConfirmButton.dataset.illustformConfirm, illustConfirmButton); return; }
  if (event.target.closest('#tmpl-msg-add')) { openTmplMsgDialog(null); return; }
  if (event.target.closest('#dm-open-templates')) {
    const tab = document.querySelector('.od-tab[data-tab="templates"]');
    if (tab) { document.querySelectorAll('.od-tab').forEach((entry) => entry.classList.toggle('is-active', entry === tab)); document.querySelectorAll('.od-panel').forEach((panel) => panel.classList.toggle('is-open', panel.id === 'panel-templates')); }
    return;
  }
  if (event.target.closest('.tmpl-msg-close')) { $('#tmpl-msg-dialog').close(); return; }
  if (event.target.closest('#tmpl-msg-delete')) { deleteTmplMsg(); return; }
  if (event.target.closest('#expr-catalog-edit')) {
    $('#expr-catalog-raw').value = expressionCatalog.join('\n');
    $('#expr-catalog-message').textContent = '';
    $('#expr-catalog-dialog').showModal();
    return;
  }
  if (event.target.closest('.expr-catalog-close')) { $('#expr-catalog-dialog').close(); return; }
  if (event.target.closest('#cal-prev')) { calState.month -= 1; if (calState.month < 0) { calState.month = 11; calState.year -= 1; } $('#cal-grid').dataset.selected = ''; renderCalendar(); return; }
  if (event.target.closest('#cal-next')) { calState.month += 1; if (calState.month > 11) { calState.month = 0; calState.year += 1; } $('#cal-grid').dataset.selected = ''; renderCalendar(); return; }
  const calDay = event.target.closest('[data-cal-day]');
  if (calDay) {
    const key = calDay.dataset.calDay;
    $('#cal-grid').dataset.selected = key;
    const items = inquiries.filter((item) => isActive(item) && item.due_date && String(item.due_date).slice(0, 10) === key);
    renderCalDayList(key, items);
    return;
  }
  if (event.target.closest('#export-csv')) { exportSalesCsv(); return; }
  if (event.target.closest('#export-json')) { exportBackupJson(); return; }
  const fileRemove = event.target.closest('[data-file-remove]');
  if (fileRemove) {
    const item = currentDetailItem();
    if (!item) return;
    if (!confirm('このファイルを一覧から削除しますか？')) return;
    const rows = filesOf(item).slice();
    rows.splice(Number(fileRemove.dataset.fileRemove), 1);
    item.files = rows;
    if (await updateInquiry(item.id, { files: item.files })) renderFileList(item);
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === 'delete') { deleteTargetId = id; $('#delete-confirm').showModal(); return; }
  if (action === 'detail') { openDetail(id); return; }
  if (action === 'edit') { editingId = editingId === id ? null : id; if (editingId) openCardIds.add(id); renderList(); return; }
  if (action === 'toggle-reply') { await refreshItem(id, { replied: button.dataset.replied !== 'true' }); return; }
  if (button.classList.contains('save-edit-button')) {
    const form = button.closest('.inquiry-edit-form');
    const patch = {
      plan: form.querySelector('[data-field="plan"]').value,
      motion: form.querySelector('[data-field="motion"]').value,
      options: form.querySelector('[data-field="options"]').value,
      total: Number(form.querySelector('[data-field="total"]').value || 0)
    };
    editingId = null;
    await refreshItem(id, patch);
    return;
  }
  if (button.classList.contains('cancel-edit-button')) { editingId = null; renderList(); }
});

$('#delete-confirm').addEventListener('click', async (event) => {
  if (event.target.id === 'delete-cancel' || event.target.id === 'delete-confirm') {
    $('#delete-confirm').close();
    deleteTargetId = null;
    return;
  }
  if (event.target.id !== 'delete-ok') return;
  const id = deleteTargetId;
  $('#delete-confirm').close();
  deleteTargetId = null;
  const { error } = await db.from('inquiries').delete().eq('id', id);
  if (error) return alert(`削除できませんでした：${error.message}`);
  editingId = null;
  await loadInquiries();
});

document.addEventListener('input', (event) => {
  const searchBox = event.target.closest('#inquiry-search');
  if (searchBox) { currentSearch = searchBox.value; renderList(); return; }
  const memoBox = event.target.closest('.memo-box');
  if (memoBox) {
    const id = memoBox.dataset.id;
    clearTimeout(memoTimers[id]);
    memoTimers[id] = setTimeout(async () => {
      await db.from('inquiries').update({ memo: memoBox.value }).eq('id', id);
      const item = inquiries.find((entry) => String(entry.id) === String(id));
      if (item) item.memo = memoBox.value;
    }, 700);
    return;
  }
  if (event.target.closest('#od-extra-items') || event.target.id === 'od-base') {
    const item = currentDetailItem();
    if (item) item.extra_items = readExtras();
    refreshTotalLine();
  }
  if (event.target.id === 'od-rev-limit' || event.target.id === 'od-rev-used') refreshRevBox();
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'od-status') { const item = currentDetailItem(); if (item) refreshCurrentStage(item); }
  if (event.target.id === 'od-due') { const item = currentDetailItem(); if (item) refreshDueCountdown(item); }
  if (event.target.id === 'od-replied') { const item = currentDetailItem(); if (item) refreshRepliedBadge(item); }
  if (event.target.id === 'od-illust-needed' || event.target.id === 'od-chardes-needed' || event.target.id === 'od-parts-ready') {
    const item = currentDetailItem();
    if (item) {
      item.illustration_needed = $('#od-illust-needed').checked;
      item.chardesign_needed = $('#od-chardes-needed').checked;
      item.parts_illustration_ready = $('#od-parts-ready').checked;
      $('#od-scope-tags').innerHTML = scopeTagsHtml(item);
      refreshProgressBox(item);
    }
    return;
  }
  if (event.target.closest('#od-progress-box')) {
    const item = currentDetailItem();
    if (item) {
      item.progress_steps = [...document.querySelectorAll('#od-progress-box [data-step]:checked')].map((box) => box.dataset.step);
      refreshProgressBox(item);
    }
  }
  if (event.target.closest('#od-expr-box')) {
    const item = currentDetailItem();
    if (item) {
      item.expressions_needed = [...document.querySelectorAll('#od-expr-box [data-expr]:checked')].map((box) => box.dataset.expr);
      refreshExpressionBox(item);
      refreshProgressBox(item);
    }
  }
  const statusSelect = event.target.closest('#status-filter');
  if (statusSelect) { statusFilter = statusSelect.value; renderList(); return; }
  const paymentSelect = event.target.closest('#payment-filter');
  if (paymentSelect) { paymentFilter = paymentSelect.value; renderList(); return; }
  const dueSelect = event.target.closest('#due-filter');
  if (dueSelect) { dueFilter = dueSelect.value; renderList(); return; }
  const planSelect = event.target.closest('#plan-filter');
  if (planSelect) { planFilter = planSelect.value; renderList(); return; }
  const sortSelect = event.target.closest('#sort-filter');
  if (sortSelect) { currentSort = sortSelect.value; renderList(); return; }
});

buildSelectOptions();
fillStaticBoxes();
document.getElementById('tmpl-msg-form').addEventListener('submit', (event) => { event.preventDefault(); saveTmplMsgForm(); });

document.getElementById('expr-catalog-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const raw = $('#expr-catalog-raw').value;
  try {
    await saveExpressionCatalog(raw);
    $('#expr-catalog-dialog').close();
    const item = currentDetailItem();
    if (item) refreshExpressionBox(item);
  } catch (error) {
    $('#expr-catalog-message').textContent = `保存できませんでした：${error.message}`;
  }
});

checkAuth();

/* ===== 追加機能：依頼カードの「︙」メニュー（編集・削除など、普段使わない操作） ===== */
document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-more-toggle]');
  document.querySelectorAll('.ic-more-menu').forEach((menu) => {
    const owner = menu.closest('.ic-more');
    const isOwn = toggle && owner && owner.contains(toggle);
    const willOpen = isOwn && menu.hidden;
    menu.hidden = !willOpen;
    owner?.querySelector('[data-more-toggle]')?.setAttribute('aria-expanded', String(willOpen));
  });
});
