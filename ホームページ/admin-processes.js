// 依頼BOX拡張：工程別進捗・工程別支払い・工程別修正回数・相談連携
// admin-inquiries.js の後で読み込まれ、その機能を包んで拡張します。

const PROCESS_STATUS = {
  todo: { label: '未着手', cls: 'ps-todo' },
  working: { label: '制作中', cls: 'ps-working' },
  awaiting: { label: '確認待ち', cls: 'ps-awaiting' },
  revising: { label: '修正中', cls: 'ps-revising' },
  ok: { label: 'OK', cls: 'ps-ok' },
  payment_wait: { label: '支払い待ち', cls: 'ps-pay' },
  payment_check: { label: '支払い確認済み', cls: 'ps-paid' },
  done: { label: '完了', cls: 'ps-done' }
};
const CONSULT_STATUS = {
  pending: { label: '未対応', cls: 'cs-pending' },
  confirming: { label: '内容確認中', cls: 'cs-confirming' },
  quoted: { label: '料金提示', cls: 'cs-quoted' },
  payment_wait: { label: '支払い待ち', cls: 'cs-pay' },
  paid: { label: '支払い確認済み', cls: 'cs-paid' },
  handling: { label: '対応中', cls: 'cs-handling' },
  resolved: { label: '対応完了', cls: 'cs-resolved' },
  cancelled: { label: 'キャンセル', cls: 'cs-cancelled' }
};

let processData = { processes: [], tasks: [], logs: [] };
let consultTaskId = null;
let processTemplates = [];

/* ===== 追加機能②：工程テンプレート ===== */
function parseProcessTemplates(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  return text.split(/^\s*===\s*$/m).map((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return null;
    const name = lines[0];
    const processes = lines.slice(1).map((line) => {
      const [procName = '', feeText = '0', tasksText = ''] = line.split('|');
      const tasks = tasksText.split(',').map((piece) => piece.trim()).filter(Boolean).map((piece) => {
        const [taskName, limitText] = piece.split(':');
        return { name: (taskName || '').trim(), rev_limit: Number((limitText || '2').trim()) || 0 };
      });
      return { name: procName.trim(), fee: Number(feeText.trim()) || 0, tasks };
    }).filter((proc) => proc.name);
    return name && processes.length ? { name, processes } : null;
  }).filter(Boolean);
}

let processTemplatesRaw = '';
async function loadProcessTemplates() {
  if (!db) return;
  const { data } = await db.from('site_settings').select('value').eq('key', 'process_templates').maybeSingle();
  processTemplatesRaw = data?.value ?? '';
  processTemplates = parseProcessTemplates(processTemplatesRaw);
}

async function saveProcessTemplatesRaw(raw) {
  const { error } = await db.from('site_settings').upsert({ key: 'process_templates', value: raw });
  if (error) throw error;
  await loadProcessTemplates();
  const item = currentDetailItem();
  if (item) renderProcessPanel(item);
}

async function applyTemplate(item, template) {
  if (!template) return;
  if (processesOf(item.id).length && !confirm(`「${template.name}」を適用します。既存の工程に追加でよろしいですか？`)) return;
  let procOrder = processesOf(item.id).length;
  for (const proc of template.processes) {
    const procRow = await dbInsert('processes', { inquiry_id: item.id, name: proc.name, fee: proc.fee, sort_order: procOrder });
    if (!procRow) continue;
    processData.processes.push(procRow);
    procOrder += 1;
    let taskOrder = 0;
    for (const task of proc.tasks) {
      const taskRow = await dbInsert('tasks', { process_id: procRow.id, inquiry_id: item.id, name: task.name, rev_limit: task.rev_limit, sort_order: taskOrder });
      if (taskRow) { processData.tasks.push(taskRow); taskOrder += 1; }
    }
  }
  renderProcessPanel(item);
}

const processesOf = (inqId) => processData.processes.filter((p) => String(p.inquiry_id) === String(inqId)).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
const tasksOf = (procId) => processData.tasks.filter((t) => String(t.process_id) === String(procId)).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
const logsOfTask = (taskId) => processData.logs.filter((l) => String(l.task_id) === String(taskId)).sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
const consultsOf = (inqId) => inquiries.filter((i) => i.related_inquiry_id && String(i.related_inquiry_id) === String(inqId));
const taskOf = (id) => processData.tasks.find((t) => String(t.id) === String(id));

function revSummary(task) {
  const limit = Number(task.rev_limit || 0);
  const used = Number(task.rev_used || 0);
  const bought = Number(task.extra_bought || 0);
  const extraUsed = Number(task.extra_used || 0);
  return { limit, used, freeLeft: Math.max(limit - used, 0), bought, extraUsed, extraLeft: Math.max(bought - extraUsed, 0), over: used > limit };
}

function revBlocksHtml(task) {
  const s = revSummary(task);
  let blocks = '';
  for (let i = 0; i < s.limit; i += 1) blocks += `<i class="${i < s.used ? 'is-on' : ''}"></i>`;
  return blocks;
}

async function loadProcessData() {
  if (!db) return;
  const [p, t, l] = await Promise.all([
    db.from('processes').select('*').order('sort_order'),
    db.from('tasks').select('*').order('sort_order'),
    db.from('revision_log').select('*').order('created_date')
  ]);
  processData.processes = p.data || [];
  processData.tasks = t.data || [];
  processData.logs = l.data || [];
  await loadProcessTemplates();
}

function renderProcessPanel(item) {
  const box = document.getElementById('panel-process');
  if (!box || !item) return;
  const procs = processesOf(item.id);
  const sumFee = procs.reduce((sum, p) => sum + Number(p.fee || 0), 0);
  const paidFee = procs.filter((p) => ['payment_check', 'done'].includes(p.status)).reduce((sum, p) => sum + Number(p.fee || 0), 0);
  const html = procs.map((proc, index) => {
    const st = PROCESS_STATUS[proc.status] || PROCESS_STATUS.todo;
    const prev = index > 0 ? procs[index - 1] : null;
    const gateLocked = prev && !['payment_check', 'done'].includes(prev.status);
    const tasks = tasksOf(proc.id);
    const taskHtml = tasks.map((task) => {
      const s = revSummary(task);
      const tst = PROCESS_STATUS[task.status] || PROCESS_STATUS.todo;
      const hist = logsOfTask(task.id).map((log) => {
        const d = new Date(log.created_date);
        return `<li>${d.getMonth() + 1}/${d.getDate()} <b>${log.kind === 'free' ? '無料' : '追加'}修正 ${log.count_no}回目</b>${log.note ? `：${escapeHtml(log.note)}` : ''}${log.kind === 'buy' ? `（追加料金 ${yen(log.fee)} / ${log.count_no}回）` : (log.kind === 'extra' && log.fee ? `（追加料金 ${yen(log.fee)}）` : '')}</li>`;
      }).join('');
      return `<div class="pt-row" data-task="${task.id}">
        <div class="pt-head"><b>${escapeHtml(task.name)}</b><select class="pt-status" data-task-status="${task.id}">${Object.entries(PROCESS_STATUS).map(([key, v]) => `<option value="${key}" ${task.status === key ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
        <span class="pt-status-badge ${tst.cls}">${tst.label}</span>
        <div class="pt-rev">
          <div class="pt-rev-line"><small>無料修正</small><span class="pt-blocks">${revBlocksHtml(task)}</span><b>${s.used} / ${s.limit}回</b><small>残り ${s.freeLeft}回</small></div>
          <div class="pt-rev-line"><small>追加修正</small><b>${s.extraUsed} / ${s.bought}回</b><small>残り ${s.extraLeft}回</small></div>
          ${s.over && !s.extraLeft ? '<p class="pt-rev-warn">⚠ 無料修正回数を超えています。追加修正は相談受付から料金を確認できます。</p>' : ''}
        </div>
        <div class="pt-actions">
          <button type="button" class="od-mini-button" data-rev-plus="${task.id}">＋1回 修正</button>
          <button type="button" class="od-mini-button" data-consult-open="${task.id}">追加修正の相談を受付</button>
          <button type="button" class="od-mini-button is-ghost" data-proc-del-task="${task.id}">作業を削除</button>
        </div>
        ${hist ? `<details class="pt-history"><summary>修正履歴（${logsOfTask(task.id).length}件）</summary><ul>${hist}</ul></details>` : ''}
      </div>`;
    }).join('');
    return `<div class="process-card" data-proc="${proc.id}">
      <div class="process-head">
        <b>${index + 1}. ${escapeHtml(proc.name)}</b>
        <span class="process-fee">${yen(proc.fee)}</span>
        <select class="pt-status" data-proc-status="${proc.id}" data-index="${index}">${Object.entries(PROCESS_STATUS).map(([key, v]) => `<option value="${key}" ${proc.status === key ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
        <span class="pt-status-badge ${st.cls}">${st.label}</span>
        <button type="button" class="od-mini-button is-ghost" data-proc-del="${proc.id}">工程を削除</button>
      </div>
      ${gateLocked ? `<p class="process-gate">🔒 前の工程（${escapeHtml(prev.name)}）の支払い確認が済むと、この工程を「制作中」に進められます（手動で進めることもできます）。</p>` : ''}
      <div class="pt-list">${taskHtml || '<p class="od-hint">作業はまだありません。下のボタンで「ラフ」「本描き」などを追加できます。</p>'}</div>
      <button type="button" class="od-mini-button" data-task-add="${proc.id}">＋ 作業を追加</button>
    </div>`;
  }).join('');
  const templateBar = processTemplates.length
    ? `<div class="template-bar"><select id="template-select" class="filter-select">${processTemplates.map((tpl, index) => `<option value="${index}">${escapeHtml(tpl.name)}</option>`).join('')}</select><button type="button" id="template-apply" class="od-mini-button">テンプレートを適用</button><button type="button" id="template-edit" class="od-mini-button is-ghost">編集</button></div>`
    : `<div class="template-bar"><p class="od-hint">工程テンプレートはまだありません。</p><button type="button" id="template-edit" class="od-mini-button is-ghost">＋ テンプレートを作成</button></div>`;
  box.innerHTML = `
    <div class="process-summary"><p>工程合計 <strong>${yen(sumFee)}</strong>（支払い確認済み ${yen(paidFee)}）</p><button type="button" id="process-add" class="od-mini-button">＋ 工程を追加</button></div>
    ${templateBar}
    ${html || '<p class="od-hint">工程はまだありません。「＋ 工程を追加」で「イラスト制作」「Live2Dモデリング」などを登録できます。</p>'}`;
}

function renderConsultPanel(item) {
  const box = document.getElementById('panel-consult');
  if (!box || !item) return;
  const rows = consultsOf(item.id);
  box.innerHTML = rows.length ? rows.map((consult) => {
    const st = CONSULT_STATUS[consult.consult_status] || CONSULT_STATUS.pending;
    const task = taskOf(consult.related_task_id);
    return `<div class="consult-row" data-consult="${consult.id}">
      <div class="consult-head"><span class="serial-tag">${escapeHtml(consult.serial)}</span><b>${escapeHtml(consult.request_name)}</b><span class="pt-status-badge ${st.cls}">${st.label}</span></div>
      <p class="consult-meta">関連工程・作業：${escapeHtml(task ? task.name : '—')} ／ 追加料金：<b>${yen(consult.extra_fee)}</b> ／ 追加修正：<b>${consult.extra_count}回</b></p>
      ${consult.message ? `<p class="consult-note">${escapeHtml(consult.message)}</p>` : ''}
      <div class="consult-actions">
        <select class="pt-status" data-consult-status="${consult.id}">${Object.entries(CONSULT_STATUS).map(([key, v]) => `<option value="${key}" ${consult.consult_status === key ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      </div>
    </div>`;
  }).join('') : '<p class="od-hint">この依頼に関連する相談はまだありません。工程タブの「追加修正の相談を受付」から作れます。</p>';
}

function renderPanels() { const item = currentDetailItem(); if (item) { renderProcessPanel(item); renderConsultPanel(item); } }

async function dbInsert(table, row) {
  const { data, error } = await db.from(table).insert(row).select().single();
  if (error) { alert(`保存できませんでした：${error.message}${/schema cache|column|table/i.test(error.message) ? '（supabase/process-management.sql を実行してください）' : ''}`); return null; }
  return data;
}

async function dbUpdate(table, patch, id) {
  const { error } = await db.from(table).update(patch).eq('id', id);
  if (error) { alert(`更新できませんでした：${error.message}`); return false; }
  return true;
}

async function addProcess(item) {
  const name = prompt('工程名を入力（例：イラスト制作）'); if (!name) return;
  const fee = Number(prompt('この工程の料金（円）', '0') || 0);
  const row = await dbInsert('processes', { inquiry_id: item.id, name, fee, sort_order: processesOf(item.id).length });
  if (!row) return;
  processData.processes.push(row);
  renderProcessPanel(item);
}

async function addTask(item, proc) {
  const name = prompt('作業名を入力（例：ラフ）'); if (!name) return;
  const limit = Number(prompt('無料修正回数（例：2）', '2') || 0);
  const row = await dbInsert('tasks', { process_id: proc.id, inquiry_id: item.id, name, rev_limit: limit, sort_order: tasksOf(proc.id).length });
  if (!row) return;
  processData.tasks.push(row);
  renderProcessPanel(item);
}

async function pushLog(row) {
  const saved = await dbInsert('revision_log', row);
  if (saved) processData.logs.push(saved);
}

async function setProcessStatus(item, proc, value, index) {
  const procs = processesOf(item.id);
  if (value === 'working' && index > 0) {
    const prev = procs[index - 1];
    if (prev && !['payment_check', 'done'].includes(prev.status)) {
      if (!confirm(`前の工程「${prev.name}」が支払い確認済みではありません。\nこのまま「${PROCESS_STATUS[value].label}」に進めますか？（手動進行）`)) { renderProcessPanel(item); return; }
    }
  }
  if (await dbUpdate('processes', { status: value }, proc.id)) { proc.status = value; renderProcessPanel(item); }
}

async function addRevision(item, task) {
  const s = revSummary(task);
  let kind;
  if (s.freeLeft > 0) kind = 'free';
  else if (s.extraLeft > 0) kind = 'extra';
  else { alert('⚠ 無料修正回数を超えています。\n追加修正を希望する場合は「追加修正の相談を受付」から料金を確認してください。'); return; }
  const note = prompt(`【${task.name}】修正内容をメモ（例：髪型変更）`) || '';
  const patch = kind === 'free' ? { rev_used: s.used + 1 } : { extra_used: s.extraUsed + 1 };
  if (!await dbUpdate('tasks', patch, task.id)) return;
  Object.assign(task, patch);
  await pushLog({ inquiry_id: item.id, task_id: task.id, task_name: task.name, kind, count_no: kind === 'free' ? s.used + 1 : s.extraUsed + 1, note, fee: 0 });
  renderProcessPanel(item);
}

async function applyConsultStatus(consult, value) {
  const task = taskOf(consult.related_task_id);
  const count = Number(consult.extra_count || 1);
  const prev = consult.consult_status;
  if (task) {
    if (value === 'paid' && prev !== 'paid') {
      const patch = { extra_bought: Number(task.extra_bought || 0) + count };
      if (await dbUpdate('tasks', patch, task.id)) { Object.assign(task, patch); await pushLog({ inquiry_id: consult.related_inquiry_id, task_id: task.id, task_name: task.name, kind: 'buy', count_no: count, note: '追加修正回数を購入', fee: Number(consult.extra_fee || 0) }); }
    } else if (prev === 'paid' && value !== 'paid') {
      const patch = { extra_bought: Math.max(Number(task.extra_bought || 0) - count, 0) };
      if (await dbUpdate('tasks', patch, task.id)) Object.assign(task, patch);
    }
  }
  if (await dbUpdate('inquiries', { consult_status: value }, consult.id)) { consult.consult_status = value; renderPanels(); }
}

function generateSerial() {
  const now = new Date();
  const pad = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  return `PNK-${pad}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function createConsult(event) {
  event.preventDefault();
  const item = currentDetailItem();
  const task = taskOf(consultTaskId);
  if (!item || !task) return;
  const note = document.getElementById('consult-note').value.trim();
  const fee = Number(document.getElementById('consult-fee').value || 0);
  const count = Number(document.getElementById('consult-count').value || 1);
  const payload = {
    serial: generateSerial(),
    request_name: `${item.request_name}様 追加修正相談（${task.name}）`,
    message: note,
    contact_method: item.contact_method || 'email',
    contact_id: item.contact_id || '',
    email: item.email || '',
    plan: item.plan || '',
    motion: item.motion || '',
    options: '',
    total: fee,
    replied: true,
    memo: '',
    consult_status: 'quoted',
    related_inquiry_id: item.id,
    related_task_id: task.id,
    extra_fee: fee,
    extra_count: count
  };
  const row = await dbInsert('inquiries', payload);
  if (!row) return;
  inquiries.push(row);
  document.getElementById('consult-form').reset();
  document.getElementById('consult-dialog').close();
  renderConsultPanel(item);
  renderList();
}

document.addEventListener('click', async (event) => {
  const openOrder = event.target.closest('[data-open-order]');
  if (openOrder) { openDetail(openOrder.dataset.openOrder); return; }
  if (event.target.closest('#process-add')) { addProcess(currentDetailItem()); return; }
  if (event.target.closest('#template-apply')) {
    const item = currentDetailItem();
    const select = document.getElementById('template-select');
    if (item && select) applyTemplate(item, processTemplates[Number(select.value)]);
    return;
  }
  if (event.target.closest('#template-edit')) {
    document.getElementById('tmpl-proc-raw').value = processTemplatesRaw;
    document.getElementById('tmpl-proc-message').textContent = '';
    document.getElementById('tmpl-proc-dialog').showModal();
    return;
  }
  if (event.target.closest('.tmpl-proc-close')) { document.getElementById('tmpl-proc-dialog').close(); return; }
  const taskAdd = event.target.closest('[data-task-add]');
  if (taskAdd) { const proc = processData.processes.find((p) => String(p.id) === String(taskAdd.dataset.taskAdd)); const item = currentDetailItem(); if (item && proc) addTask(item, proc); return; }
  const revPlus = event.target.closest('[data-rev-plus]');
  if (revPlus) { const task = taskOf(revPlus.dataset.revPlus); const item = currentDetailItem(); if (item && task) addRevision(item, task); return; }
  const consultOpen = event.target.closest('[data-consult-open]');
  if (consultOpen) {
    consultTaskId = consultOpen.dataset.consultOpen;
    const task = taskOf(consultTaskId);
    document.getElementById('consult-title').textContent = `追加修正の相談を受付【${task ? task.name : ''}】`;
    document.getElementById('consult-dialog').showModal();
    return;
  }
  if (event.target.closest('.consult-close')) { document.getElementById('consult-dialog').close(); return; }
  const procDel = event.target.closest('[data-proc-del]');
  if (procDel) {
    if (!confirm('この工程を削除しますか？（中の作業・履歴も消えます）')) return;
    const { error } = await db.from('processes').delete().eq('id', procDel.dataset.procDel);
    if (error) return alert(`削除できませんでした：${error.message}`);
    processData.processes = processData.processes.filter((p) => String(p.id) !== String(procDel.dataset.procDel));
    renderPanels();
    return;
  }
  const taskDel = event.target.closest('[data-proc-del-task]');
  if (taskDel) {
    if (!confirm('この作業を削除しますか？')) return;
    const { error } = await db.from('tasks').delete().eq('id', taskDel.dataset.procDelTask);
    if (error) return alert(`削除できませんでした：${error.message}`);
    processData.tasks = processData.tasks.filter((t) => String(t.id) !== String(taskDel.dataset.procDelTask));
    renderPanels();
  }
});

document.addEventListener('change', async (event) => {
  const procSel = event.target.closest('[data-proc-status]');
  if (procSel) {
    const item = currentDetailItem();
    const proc = processData.processes.find((p) => String(p.id) === String(procSel.dataset.procStatus));
    if (item && proc) setProcessStatus(item, proc, procSel.value, Number(procSel.dataset.index));
    return;
  }
  const taskSel = event.target.closest('[data-task-status]');
  if (taskSel) {
    const task = taskOf(taskSel.dataset.taskStatus);
    if (task && await dbUpdate('tasks', { status: taskSel.value }, task.id)) { task.status = taskSel.value; renderProcessPanel(currentDetailItem()); }
    return;
  }
  const consultSel = event.target.closest('[data-consult-status]');
  if (consultSel) {
    const consult = inquiries.find((i) => String(i.id) === String(consultSel.dataset.consultStatus));
    if (consult) applyConsultStatus(consult, consultSel.value);
  }
});

// 既存関数を包んで拡張（既存機能はそのまま動きます）
const _origLoadInquiries = loadInquiries;
loadInquiries = async function () { await _origLoadInquiries(); await loadProcessData(); if (document.getElementById('order-detail').open) renderPanels(); };

const _origOpenDetail = openDetail;
openDetail = function (id) { _origOpenDetail(id); renderPanels(); };

const _origRenderList = renderList;
renderList = function () {
  _origRenderList();
  document.querySelectorAll('.inquiry-card').forEach((card) => {
    const item = inquiries.find((entry) => String(entry.id) === String(card.dataset.id));
    if (!item || !item.related_inquiry_id) return;
    card.querySelector('.inquiry-card-id').insertAdjacentHTML('beforeend', '<span class="order-status-badge st-consult">相談</span>');
    const actions = card.querySelector('.inquiry-card-actions');
    if (actions) actions.insertAdjacentHTML('afterbegin', `<button class="detail-button" data-open-order="${item.related_inquiry_id}">依頼を開く <span>→</span></button>`);
  });
};

document.getElementById('consult-form').addEventListener('submit', createConsult);

document.getElementById('tmpl-proc-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const raw = document.getElementById('tmpl-proc-raw').value;
  const message = document.getElementById('tmpl-proc-message');
  try {
    await saveProcessTemplatesRaw(raw);
    document.getElementById('tmpl-proc-dialog').close();
  } catch (error) {
    message.textContent = `保存できませんでした：${error.message}`;
  }
});

globalThis.__P = () => ({ processData, renderProcessPanel, renderConsultPanel, addProcess, addTask, addRevision, applyConsultStatus, setProcessStatus, createConsult, loadProcessData });
