const configured = Boolean(window.PINOKII_SUPABASE?.url && window.PINOKII_SUPABASE?.anonKey);
const db = configured && window.supabase ? window.supabase.createClient(window.PINOKII_SUPABASE.url, window.PINOKII_SUPABASE.anonKey) : null;
const $ = (selector) => document.querySelector(selector);

// 依頼管理（admin-inquiries.js）の STATUS と同じラベルを使用（表示のみ、値は変更しない）
const STATUS_LABELS = {
  received: '受付',
  prep: '制作準備',
  working: '制作中',
  awaiting: 'クライアント確認待ち',
  revising: '修正中',
  final: '最終確認',
  delivered: '納品',
  completed: '完了',
  cancelled: 'キャンセル'
};

const PAYMENT_LABELS = {
  unpaid: '未払い',
  wait: '入金確認中',
  paid: 'お支払い済み'
};

function yen(value) {
  return `¥${Number(value || 0).toLocaleString('ja-JP')}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function fmtDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('ja-JP');
}

function fmtDate(value) {
  if (!value) return '未定';
  return new Date(value).toLocaleDateString('ja-JP');
}

let currentSerial = '';
let currentData = null;
let couponSettings = {};

async function loadCouponSettings() {
  if (!db) return;
  const { data } = await db.from('site_settings').select('key,value').in('key', ['coupon_enabled', 'coupon_percent']);
  couponSettings = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
}

function hideAllSteps() {
  ['oc-code-step', 'oc-pending-step', 'oc-agreed-step', 'oc-main-step', 'oc-done-step'].forEach((id) => { $(`#${id}`).hidden = true; });
}

async function handleCodeSubmit(event) {
  event.preventDefault();
  const message = $('#oc-code-message');
  const serial = $('#oc-serial').value.trim();
  if (!serial) return;
  message.style.color = '#c14978';
  if (!db) { message.textContent = '現在この機能は準備中です。しばらくしてから再度お試しください。'; return; }
  message.textContent = '確認中…';
  const { data, error } = await db.rpc('get_order_confirmation', { p_serial: serial });
  if (error) { message.textContent = `確認できませんでした：${error.message}`; return; }
  if (!data || !data.serial) { message.textContent = 'そのお客様コードが見つかりませんでした。入力内容をご確認ください。'; return; }
  message.textContent = '';
  currentSerial = serial;
  currentData = data;

  if (data.confirmation_agreed_at) {
    hideAllSteps();
    $('#oc-agreed-serial').textContent = serial;
    $('#oc-agreed-text').textContent = `${fmtDateTime(data.confirmation_agreed_at)} に同意済みです。ご確認ありがとうございました。`;
    $('#oc-agreed-step').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (!data.total || Number(data.total) <= 0) {
    hideAllSteps();
    $('#oc-pending-serial').textContent = serial;
    $('#oc-pending-step').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  await loadCouponSettings();
  renderMain(data);
  hideAllSteps();
  $('#oc-main-step').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderMain(data) {
  $('#oc-serial-display').textContent = data.serial;
  $('#oc-name').textContent = data.request_name ? `${data.request_name} 様` : '';
  $('#oc-serial-2').textContent = data.serial;
  $('#oc-status').textContent = STATUS_LABELS[data.order_status] || data.order_status || '受付';

  // ② ご依頼内容
  const messageSection = $('#oc-message-section');
  const messageBlocks = [];
  if (data.hearing_summary && data.hearing_summary.trim()) {
    messageBlocks.push(`<div class="oc-message-block"><p class="oc-message-heading">ヒアリング内容</p><p class="oc-message-text">${escapeHtml(data.hearing_summary).replace(/\n/g, '<br>')}</p></div>`);
  }
  if (data.message && data.message.trim()) {
    messageBlocks.push(`<div class="oc-message-block"><p class="oc-message-heading">ご依頼時のメッセージ</p><p class="oc-message-text">${escapeHtml(data.message).replace(/\n/g, '<br>')}</p></div>`);
  }
  if (messageBlocks.length) {
    $('#oc-message-card').innerHTML = messageBlocks.join('');
    messageSection.hidden = false;
  } else {
    messageSection.hidden = true;
  }

  // ③ 制作内容の詳細（実際に記録されている項目だけを表示する）
  const detailRows = [];
  if (data.plan) detailRows.push(['プラン', data.plan]);
  if (data.motion) detailRows.push(['可動域', data.motion]);
  if (data.options) detailRows.push(['追加オプション', data.options]);
  detailRows.push(['イラスト制作', data.illustration_needed ? '必要' : '不要（支給あり）']);
  detailRows.push(['キャラクターデザイン', data.chardesign_needed ? '必要' : '不要（支給あり）']);
  if (data.parts_illustration_ready) detailRows.push(['パーツ分け済みイラスト', 'あり']);
  if (Array.isArray(data.expressions_needed) && data.expressions_needed.length) detailRows.push(['表情', data.expressions_needed.join('、')]);
  $('#oc-detail-card').innerHTML = detailRows.map(([label, value]) => `<div class="oc-info-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('');

  // ④ 合計金額（inquiries に実際に記録されている金額のみを使用。計算式は作らない）
  const baseAmount = Number(data.base_amount || 0);
  const extraItems = Array.isArray(data.extra_items) ? data.extra_items : [];
  const total = Number(data.total || 0);
  $('#oc-total-amount').textContent = yen(total);
  const couponNote = $('#oc-coupon-note');
  const couponOn = String(couponSettings.coupon_enabled ?? true) !== 'false';
  const couponPercent = Number(couponSettings.coupon_percent || 0);
  if (couponNote) { couponNote.hidden = !(couponOn && couponPercent > 0); couponNote.textContent = `${couponPercent}%OFFクーポン使用`; }
  const breakdownRows = [`<div class="oc-breakdown-row"><span>基本料金</span><b>${yen(baseAmount)}</b></div>`];
  extraItems.forEach((extra) => { breakdownRows.push(`<div class="oc-breakdown-row"><span>${escapeHtml(extra.label || '追加料金')}</span><b>${yen(extra.fee)}</b></div>`); });
  breakdownRows.push(`<div class="oc-breakdown-row oc-breakdown-total"><span>合計</span><b>${yen(total)}</b></div>`);
  $('#oc-total-breakdown').innerHTML = breakdownRows.join('');

  // ⑤ 制作条件
  const revLimit = Number(data.revision_limit ?? 2);
  const revUsed = Number(data.revision_used || 0);
  const revExtraFee = Number(data.revision_extra_fee || 0);
  const revisionText = revExtraFee > 0
    ? `${revLimit}回まで無料（現在${revUsed}回使用）。${revLimit}回を超えると、1回につき+${yen(revExtraFee)}の追加料金がかかります（内容により変動する場合があります）。`
    : `${revLimit}回まで無料（現在${revUsed}回使用）。${revLimit}回を超える修正は、内容により追加料金をご案内いたします。`;
  $('#oc-revision').textContent = revisionText;
  $('#oc-due').textContent = fmtDate(data.due_date);

  // 同意フォームをリセット
  const form = $('#oc-agree-form');
  form.reset();
  document.querySelectorAll('input[name="payment_method"]').forEach((input) => { input.checked = false; });
  updateAgreeButtonState();
}

function updateAgreeButtonState() {
  const form = $('#oc-agree-form');
  const allChecked = ['check1', 'check2', 'check3'].every((name) => form.elements[name].checked);
  const paymentSelected = Boolean(document.querySelector('input[name="payment_method"]:checked'));
  $('#oc-agree-button').disabled = !(allChecked && paymentSelected);
}

async function notifyDiscordAgreement(serial, name) {
  if (!db) return;
  const { data } = await db.from('site_settings').select('key,value').in('key', ['discord_webhook_url', 'discord_notify_enabled']);
  const map = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
  const url = map.discord_webhook_url;
  const enabled = String(map.discord_notify_enabled ?? true) !== 'false';
  if (!url || !enabled) return;
  const content = `✅ 制作内容にご同意いただきました\nお名前：${name}\nお客様コード：${serial}\n\n依頼管理でご確認ください。`;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
  } catch (error) { /* 通知が失敗しても同意の記録自体は完了しているので何もしない */ }
}

let agreeSubmitting = false;

async function handleAgreeSubmit(event) {
  event.preventDefault();
  if (agreeSubmitting) return; // 二重送信の防止（クライアント側）
  const message = $('#oc-agree-message');
  const button = $('#oc-agree-button');
  agreeSubmitting = true;
  button.disabled = true;
  message.style.color = '#c14978';
  message.textContent = '送信中…';
  const { data, error } = await db.rpc('agree_to_confirmation', { p_serial: currentSerial, p_payment_method: document.querySelector('input[name="payment_method"]:checked')?.value || null });
  if (error) {
    message.textContent = `送信できませんでした：${error.message}`;
    agreeSubmitting = false;
    updateAgreeButtonState();
    return;
  }
  if (!data.success) {
    if (data.error === 'already_agreed') {
      // すでに同意済み（別タブなどで二重送信された場合）。サーバー側で正しく防止されている。
      hideAllSteps();
      $('#oc-agreed-serial').textContent = currentSerial;
      $('#oc-agreed-text').textContent = `${fmtDateTime(data.agreed_at)} に同意済みです。ご確認ありがとうございました。`;
      $('#oc-agreed-step').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    message.textContent = '送信できませんでした。もう一度お試しいただくか、お問い合わせください。';
    agreeSubmitting = false;
    updateAgreeButtonState();
    return;
  }
  notifyDiscordAgreement(currentSerial, currentData?.request_name || '');
  hideAllSteps();
  $('#oc-done-step').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function init() {
  const initialSerial = new URLSearchParams(location.search).get('serial');
  if (initialSerial) $('#oc-serial').value = initialSerial;
  $('#oc-code-form').addEventListener('submit', handleCodeSubmit);
  $('#oc-agree-form').addEventListener('submit', handleAgreeSubmit);
  $('#oc-agree-form').addEventListener('change', updateAgreeButtonState);
  $('#oc-payment-choices').addEventListener('change', updateAgreeButtonState);
}

init();
