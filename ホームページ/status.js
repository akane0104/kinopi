const configured = Boolean(window.PINOKII_SUPABASE?.url && window.PINOKII_SUPABASE?.anonKey);
const db = configured && window.supabase ? window.supabase.createClient(window.PINOKII_SUPABASE.url, window.PINOKII_SUPABASE.anonKey) : null;
const $ = (selector) => document.querySelector(selector);

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
const PROCESS_STATUS = {
  todo: '未着手', working: '制作中', awaiting: '確認待ち', revising: '修正中',
  ok: 'OK', payment_wait: '支払い待ち', payment_check: '支払い確認済み', done: '完了'
};
// 管理画面の STEPS と同じ並び。イラスト・キャラデザ・表情の有無によって、依頼ごとに項目数が変わります。
const BASE_STEP_IDS = ['confirm', 'payment', 'psd', 'modeling', 'vts', 'client', 'revision', 'final', 'deliver'];

function stepIdsForResult(result) {
  const ids = BASE_STEP_IDS.slice();
  if (result.illustration_needed) ids.push('illust');
  if (result.chardesign_needed) ids.push('chardesign');
  (Array.isArray(result.expressions_needed) ? result.expressions_needed : []).forEach((name) => ids.push(`expr:${name}`));
  return ids;
}

function fmtDate(dateStr) {
  if (!dateStr) return '未定';
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '未定';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function render(result) {
  const message = $('#status-message');
  const box = $('#status-result');
  if (!result) {
    message.textContent = 'そのシリアルナンバーの依頼が見つかりませんでした。入力内容をご確認ください。';
    box.hidden = true;
    return;
  }
  message.textContent = '';
  box.hidden = false;

  $('#status-serial-tag').textContent = result.serial;
  $('#status-name').textContent = result.request_name;

  const status = result.cancelled ? 'cancelled' : (STATUS[result.order_status] ? result.order_status : 'received');
  const st = STATUS[status];
  const badge = $('#status-badge');
  badge.textContent = st.label;
  badge.className = `order-status-badge ${st.cls}`;

  $('#status-created').textContent = result.created_date ? fmtDate(result.created_date) : '—';
  $('#status-due').textContent = result.due_date ? fmtDate(result.due_date) : '未定';

  const validIds = stepIdsForResult(result);
  const stepsDone = Array.isArray(result.progress_steps) ? result.progress_steps.filter((id) => validIds.includes(id)).length : 0;
  const stepTotal = validIds.length;
  const percent = stepTotal ? Math.round((stepsDone / stepTotal) * 100) : 0;
  $('#status-percent').textContent = `${Math.min(percent, 100)}%`;
  $('#status-count').textContent = `${stepsDone} / ${stepTotal} 完了`;
  $('#status-progress-fill').style.width = `${Math.min(percent, 100)}%`;

  const processes = Array.isArray(result.processes) ? result.processes : [];
  const procBox = $('#status-processes');
  procBox.innerHTML = processes.length
    ? processes.map((p) => `<div class="status-process-row"><b>${escapeHtml(p.name)}</b><span>${escapeHtml(PROCESS_STATUS[p.status] || p.status)}</span></div>`).join('')
    : '';

  const limit = Number(result.revision_limit ?? 2);
  const used = Number(result.revision_used || 0);
  const left = Math.max(limit - used, 0);
  $('#status-rev-text').textContent = `${used} / ${limit}回 使用（残り ${left}回）`;
}

async function lookup(serial) {
  const message = $('#status-message');
  message.style.color = '#c14978';
  if (!db) { message.textContent = '現在この機能は準備中です。しばらくしてから再度お試しください。'; return; }
  message.textContent = '確認中…';
  const { data, error } = await db.rpc('get_order_status', { p_serial: serial.trim() });
  if (error) { message.textContent = `確認できませんでした：${error.message}`; $('#status-result').hidden = true; return; }
  render(data);
}

$('#status-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const serial = $('#status-serial').value.trim();
  if (!serial) return;
  lookup(serial);
});

const initial = new URLSearchParams(location.search).get('serial');
if (initial) { $('#status-serial').value = initial; lookup(initial); }
