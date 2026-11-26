/* Pretoy v2 shared UI helpers: formatting, modals, toasts, photo handling, layout. */
(function () {
  'use strict';
  const UI = {};
  UI.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  UI.inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  UI.date = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  UI.dateTime = d => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  UI.ago = d => { const s = (Date.now() - new Date(d)) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; };
  UI.off = (mrp, price) => mrp ? Math.round((1 - price / mrp) * 100) : 0;
  UI.$ = (s, r) => (r || document).querySelector(s);
  UI.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  UI.form = f => { const o = {}; new FormData(f).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); UI.$$('input[type=checkbox]', f).forEach(c => { if (c.name) o[c.name] = c.checked; }); return o; };

  /* toast */
  UI.toast = (msg, kind) => {
    let wrap = UI.$('#toasts'); if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toasts'; document.body.appendChild(wrap); }
    const t = document.createElement('div'); t.className = 'toast ' + (kind || 'ok'); t.setAttribute('role', 'status'); t.textContent = msg; wrap.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3600); setTimeout(() => t.remove(), 4100);
  };

  /* modal */
  UI.modal = (html, opts) => {
    UI.closeModal();
    const m = document.createElement('div'); m.id = 'modal'; m.className = 'modal-back';
    m.innerHTML = `<div class="modal ${opts && opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><button class="modal-x" data-act="close-modal" aria-label="Close">×</button>${html}</div>`;
    m.addEventListener('mousedown', e => { if (e.target === m) UI.closeModal(); });
    document.body.appendChild(m); document.body.classList.add('noscroll');
    const first = m.querySelector('input,select,textarea,button:not(.modal-x)'); if (first) setTimeout(() => first.focus(), 30);
    return m;
  };
  UI.closeModal = () => { const m = UI.$('#modal'); if (m) m.remove(); document.body.classList.remove('noscroll'); };
  UI.confirm = (title, body, okLabel) => new Promise(res => {
    const m = UI.modal(`<h3>${UI.esc(title)}</h3><p class="muted">${UI.esc(body)}</p><div class="row end gap"><button class="btn ghost" id="cf-no">Cancel</button><button class="btn dark" id="cf-yes">${UI.esc(okLabel || 'Confirm')}</button></div>`);
    m.querySelector('#cf-no').onclick = () => { UI.closeModal(); res(false); };
    m.querySelector('#cf-yes').onclick = () => { UI.closeModal(); res(true); };
  });
  UI.prompt = (title, label, value, type) => new Promise(res => {
    const m = UI.modal(`<h3>${UI.esc(title)}</h3><form id="pf"><label>${UI.esc(label)}<input name="v" type="${type || 'text'}" value="${UI.esc(value || '')}" required></label><div class="row end gap"><button type="button" class="btn ghost" id="pf-no">Cancel</button><button class="btn dark">Save</button></div></form>`);
    m.querySelector('#pf-no').onclick = () => { UI.closeModal(); res(null); };
    m.querySelector('#pf').onsubmit = e => { e.preventDefault(); const v = e.target.v.value; UI.closeModal(); res(v); };
  });

  /* toy artwork: uploaded photo, else an emoji tile */
  UI.art = (p, cls) => {
    const img = p.images && p.images[0];
    return img ? `<div class="art ${cls || ''}"><img src="${img}" alt="${UI.esc(p.name)}" loading="lazy"></div>`
      : `<div class="art ${cls || ''}" style="--tile:${p.color || '#eee6d8'}"><span aria-hidden="true">${p.emoji || '🧸'}</span></div>`;
  };

  /* photo upload: resize in the browser so localStorage stays small */
  UI.readPhotos = (files, max) => Promise.all(Array.from(files).slice(0, max || 4).map(f => new Promise((res, rej) => {
    if (!f.type.startsWith('image/')) return rej(new Error('Only image files can be uploaded.'));
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const s = Math.min(1, 640 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.72)); }; img.onerror = () => rej(new Error('Could not read image')); img.src = r.result; };
    r.onerror = rej; r.readAsDataURL(f);
  })));

  UI.download = (name, text, type) => { const b = new Blob([text], { type: type || 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200); };

  UI.statusPill = s => `<span class="pill st-${String(s).toLowerCase()}">${UI.esc(String(s).replace(/_/g, ' ').toLowerCase())}</span>`;
  UI.gradeBadge = g => g ? `<span class="badge grade-${g}">Grade ${g} · ${Store.RULES.gradeLabels[g]}</span>` : '';
  UI.stars = n => '★★★★★'.slice(0, n) + '<span class="dim">' + '★★★★★'.slice(0, 5 - n) + '</span>';

  window.PretoyUI = UI;
})();
