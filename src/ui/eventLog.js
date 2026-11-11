/** Olay günlüğü + toast bildirimleri */

const SEVERITY_ORDER = { critical: 0, high: 1, warning: 2, info: 3, success: 4 };

export class EventLog {
  constructor() {
    this.container = document.getElementById('log-container');
    this.toast = document.getElementById('event-toast');
    this.entries = [];
    this.max = 120;
    this._toastTimer = null;
    this._lastFloodAt = 0;

    document.getElementById('btn-clear-log').addEventListener('click', () => {
      this.entries = [];
      this.container.innerHTML = '';
    });
  }

  /** Olay türü → log'a kaydet (combustion silent olayları flood yapmasın) */
  push(event) {
    if (event.silent) {
      // Sadece misfire gibi uyarıları loga al, normal ateşlemeyi alma
      if (event.severity === 'info') return;
    }

    // Flood koruması: aynı başlık 500ms içinde çok gelirse sayacı artır
    const now = performance.now();
    if (this._lastTitle === event.title && now - this._lastFloodAt < 500) {
      this._lastFloodAt = now;
      this._count = (this._count || 1) + 1;
      this._flushRepeat();
      return;
    }
    this._flushRepeat();

    this._lastTitle = event.title;
    this._lastFloodAt = now;
    this._count = 1;

    const entry = { ...event, time: new Date().toLocaleTimeString('tr-TR') };
    this.entries.unshift(entry);
    if (this.entries.length > this.max) this.entries.pop();

    const div = document.createElement('div');
    div.className = `log-item sev-${event.severity || 'info'}`;
    div.innerHTML = `
      <div class="log-meta">
        <span class="sev-badge">${sevLabel(event.severity)}</span>
        <span class="log-time">${entry.time}</span>
        <span class="repeat"></span>
      </div>
      <div class="log-title">${escapeHtml(event.title)}</div>
      <div class="log-msg">${escapeHtml(event.message || '')}</div>
    `;
    this.container.prepend(div);
    this._lastEl = div;

    // En fazla 200 DOM node
    while (this.container.children.length > 200) {
      this.container.lastChild.remove();
    }

    // Toast: sadece önemli olaylar
    if (event.severity && SEVERITY_ORDER[event.severity] <= 2) {
      this.showToast(event);
    }
  }

  _flushRepeat() {
    if (this._count > 1 && this._lastEl && this._lastEl.isConnected) {
      const el = this._lastEl.querySelector('.repeat');
      if (el) el.textContent = `×${this._count}`;
    }
  }

  showToast(event) {
    this.toast.textContent = `${event.title} — ${event.message || ''}`;
    this.toast.className = `show sev-${event.severity}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toast.className = 'hidden';
    }, 3500);
  }
}

function sevLabel(s) {
  return (
    {
      critical: 'KRİTİK',
      high: 'YÜKSEK',
      warning: 'UYARI',
      info: 'BİLGİ',
      success: 'TAMAM',
    }[s] || 'BİLGİ'
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
