const configured = Boolean(window.PINOKII_SUPABASE?.url && window.PINOKII_SUPABASE?.anonKey);
const db = configured && window.supabase ? window.supabase.createClient(window.PINOKII_SUPABASE.url, window.PINOKII_SUPABASE.anonKey) : null;

const ROWS = [
  { key: 'legal_business_name', label: '事業者名' },
  { key: 'legal_representative', label: '運営責任者' },
  { key: 'legal_address', label: '所在地' },
  { key: 'legal_phone', label: '電話番号' },
  { key: 'legal_email', label: 'メールアドレス' },
  { key: 'legal_price_note', label: '販売価格' },
  { key: 'legal_extra_fees', label: '商品代金以外の必要料金' },
  { key: 'legal_payment_methods', label: 'お支払い方法' },
  { key: 'legal_payment_timing', label: 'お支払い時期' },
  { key: 'legal_delivery_time', label: '引き渡し時期' },
  { key: 'legal_return_policy', label: '返品・キャンセルについて' },
  { key: 'legal_other', label: 'その他' }
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function render() {
  const table = document.getElementById('legal-table');
  const empty = document.getElementById('legal-empty');
  if (!db) { empty.hidden = false; return; }
  const { data } = await db.from('site_settings').select('key,value').in('key', ROWS.map((row) => row.key));
  const map = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
  const filled = ROWS.filter((row) => map[row.key]);
  if (!filled.length) { empty.hidden = false; return; }
  table.innerHTML = filled.map((row) => `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(map[row.key]).replace(/\n/g, '<br>')}</td></tr>`).join('');
}

render();
