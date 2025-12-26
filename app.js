import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18.2.0';
import { createRoot } from 'https://esm.sh/react-dom@18.2.0/client';
import htm from 'https://esm.sh/htm@3.1.1';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const html = htm.bind(React.createElement);

const byteUnits = ['B', 'KB', 'MB', 'GB'];
const formatBytes = (value = 0) => {
  if (!value) return '0 B';
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), byteUnits.length - 1);
  const size = value / 1024 ** exponent;
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${byteUnits[exponent]}`;
};

const createId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function useMediaStats(items) {
  return useMemo(() => {
    const base = { total: items.length, keep: 0, delete: 0, pending: 0 };
    for (const item of items) {
      base[item.status ?? 'pending'] += 1;
    }
    return base;
  }, [items]);
}

function App() {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState('all');
  const [statusMessage, setStatusMessage] = useState('');
  const [isZipping, setIsZipping] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  const stats = useMediaStats(items);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;
  const decidedCount = stats.total - stats.pending;
  const progress = stats.total ? decidedCount / stats.total : 0;

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => (i.status ?? 'pending') === filter);
  }, [items, filter]);

  const revokeAll = (list) => {
    for (const item of list) {
      if (item.url) URL.revokeObjectURL(item.url);
    }
  };

  useEffect(() => () => revokeAll(items), [items]);

  const handleFiles = (event) => {
    const picked = Array.from(event.target.files ?? []);
    const media = picked
      .filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
      .map((file, index) => ({
        id: createId() + '-' + index,
        file,
        url: URL.createObjectURL(file),
        name: file.webkitRelativePath || file.name,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        status: 'pending',
      }));

    setItems((prev) => {
      revokeAll(prev);
      return media;
    });
    setActiveId(media[0]?.id ?? null);
    setIsExpanded(true);
    setFilter('all');
    setStatusMessage(media.length ? `${media.length} Dateien geladen.` : '');
  };

  const goToNeighbor = (direction = 1, mode = 'pending') => {
    if (!items.length) return;
    const list = mode === 'pending' ? items.filter((i) => (i.status ?? 'pending') === 'pending') : items;
    if (!list.length) return;
    const currentIdx = list.findIndex((i) => i.id === activeId);
    const nextIdx = (currentIdx + direction + list.length) % list.length;
    const target = list[nextIdx];
    setActiveId(target.id);
    setIsExpanded(true);
  };

  const goToNextPending = (updated) => {
    const source = updated ?? items;
    const pending = source.filter((i) => (i.status ?? 'pending') === 'pending');
    if (!pending.length) return;
    const currentPendingIndex = pending.findIndex((i) => i.id === activeId);
    const nextPending = pending[(currentPendingIndex + 1) % pending.length];
    setActiveId(nextPending.id);
    setIsExpanded(true);
  };

  const handleDecision = (status) => {
    if (!activeItem) return;
    let previous = 'pending';
    const nextItems = items.map((item) => {
      if (item.id === activeItem.id) {
        previous = item.status ?? 'pending';
        return { ...item, status };
      }
      return item;
    });
    setItems(nextItems);
    setLastAction({ id: activeItem.id, from: previous, to: status });
    if (nextItems.some((i) => (i.status ?? 'pending') === 'pending')) {
      goToNextPending(nextItems);
    }
  };

  const undoLast = () => {
    if (!lastAction) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === lastAction.id ? { ...item, status: lastAction.from ?? 'pending' } : item
      )
    );
    setActiveId(lastAction.id);
    setIsExpanded(true);
    setLastAction(null);
  };

  const toggleThumb = (id) => {
    if (id === activeId) {
      setIsExpanded((v) => !v);
    } else {
      setActiveId(id);
      setIsExpanded(true);
    }
  };

  const downloadZip = async () => {
    const keepers = items.filter((i) => i.status === 'keep');
    if (!keepers.length) {
      setStatusMessage('Keine behaltenen Dateien zum Download.');
      return;
    }
    setIsZipping(true);
    setStatusMessage('Erstelle ZIP …');
    try {
      const zip = new JSZip();
      for (const item of keepers) {
        const buffer = await item.file.arrayBuffer();
        const path = item.name || item.file.name;
        zip.file(path, buffer);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'behalten.zip';
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage(`${keepers.length} Dateien als ZIP gespeichert.`);
    } catch (err) {
      console.error(err);
      setStatusMessage('Konnte ZIP nicht erstellen.');
    } finally {
      setIsZipping(false);
    }
  };

  useEffect(() => {
    const onKey = (event) => {
      if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.key === 'ArrowRight') goToNeighbor(1, 'pending');
      if (event.key === 'ArrowLeft') goToNeighbor(-1, 'pending');
      if (event.key.toLowerCase() === 'k') handleDecision('keep');
      if (event.key.toLowerCase() === 'd') handleDecision('delete');
      if (event.key.toLowerCase() === 'u') undoLast();
      if (event.key === ' ') goToNeighbor(1, 'pending');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, activeId, lastAction]);

  const reviewDelete = items.filter((i) => i.status === 'delete');

  return html`
    <div class="app">
      <div class="header">
        <h1>Bild- & Video-Aussortierer</h1>
        <div class="pill-row">
          <span class="pill">Entscheide schnell mit Tastatur: <kbd>k</kbd> behalten, <kbd>d</kbd> löschen, <kbd>←/→</kbd> nächstes</span>
        </div>
      </div>

      <div class="upload-card">
        <div class="upload-row">
          <label>
            <input type="file" webkitdirectory directory multiple accept="image/*,video/*" onChange=${handleFiles} />
          </label>
          <div class="pill-row">
            <span class="pill"><strong>${stats.total}</strong> Dateien</span>
            <span class="pill"><strong>${stats.pending}</strong> offen</span>
            <span class="pill"><strong>${stats.keep}</strong> behalten</span>
            <span class="pill"><strong>${stats.delete}</strong> Löschen</span>
          </div>
        </div>
      </div>

      <div class="main">
        <div class="panel">
          <div class="media-stage">
            ${activeItem
              ? html`<div class=${`frame ${isExpanded ? 'expanded' : 'shrunk'}`}>
                  ${activeItem.type === 'image'
                    ? html`<img src=${activeItem.url} alt=${activeItem.name} loading="eager" />`
                    : html`<video src=${activeItem.url} controls preload="metadata" />`}
                </div>`
              : html`<div class="helper-text">Lade einen Ordner mit Bildern oder Videos.</div>`}
          </div>

          <div class="meta-row">
            <div>
              <div class="helper-text">${activeItem ? activeItem.name : 'Keine Auswahl'}</div>
              ${activeItem
                ? html`<div class="small">${activeItem.file ? formatBytes(activeItem.file.size) : ''}</div>`
                : null}
            </div>
            ${activeItem
              ? html`<span class=${`badge ${activeItem.status}`}>${
                  activeItem.status === 'keep'
                    ? 'Behalten'
                    : activeItem.status === 'delete'
                    ? 'Zur Löschung markiert'
                    : 'Ausstehend'
                }</span>`
              : null}
          </div>

          <div class="button-row">
            <button class="btn ghost" onClick=${() => goToNeighbor(-1, 'pending')} disabled=${!stats.pending}>
              Zurück
            </button>
            <button class="btn keep" onClick=${() => handleDecision('keep')} disabled=${!activeItem}>
              Behalten (k)
            </button>
            <button class="btn delete" onClick=${() => handleDecision('delete')} disabled=${!activeItem}>
              Löschen (d)
            </button>
            <button class="btn ghost" onClick=${undoLast} disabled=${!lastAction}>
              Rückgängig (u)
            </button>
            <button class="btn ghost" onClick=${() => goToNeighbor(1, 'pending')} disabled=${!stats.pending}>
              Überspringen
            </button>
          </div>

          <div class="progress">
            <div class="progress-bar">
              <span style=${{ transform: `scaleX(${progress})` }}></span>
            </div>
            <span>${decidedCount}/${stats.total || 0} erledigt</span>
          </div>
        </div>

        <div class="panel thumbnail-panel">
          <div class="thumbnail-header">
            <div>
              <strong>Kontrollliste</strong>
              <div class="helper-text">Klick = maximieren, erneut = verkleinern</div>
            </div>
            <div class="filters">
              ${['all', 'pending', 'keep', 'delete'].map(
                (key) => html`<button
                  key=${key}
                  class=${`btn ${filter === key ? 'primary' : 'ghost'}`}
                  onClick=${() => setFilter(key)}
                >
                  ${key === 'all' ? 'Alle' : key === 'pending' ? 'Offen' : key === 'keep' ? 'Behalten' : 'Löschen'}
                </button>`
              )}
            </div>
          </div>

          <div class="thumbnail-grid">
            ${filteredItems.map(
              (item) => html`<div
                key=${item.id}
                class=${`thumb ${item.id === activeId ? 'active' : ''} ${item.id === activeId && isExpanded ? 'expanded' : ''}`}
                onClick=${() => toggleThumb(item.id)}
                title=${item.name}
              >
                ${item.type === 'image'
                  ? html`<img src=${item.url} alt=${item.name} loading="lazy" />`
                  : html`<video src=${item.url} muted preload="metadata"></video>`}
                ${item.status !== 'pending'
                  ? html`<span class=${`status-dot ${item.status}`}></span>`
                  : null}
                <div class="overlay">${item.status === 'pending' ? 'Offen' : item.status === 'keep' ? 'Behalten' : 'Löschen'}</div>
              </div>`
            )}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="footer">
          <div>
            <strong>Review der Löschkandidaten</strong>
            <div class="helper-text">Vor dem endgültigen Löschen kannst du noch einmal prüfen.</div>
            <div class="stacked-list">
              ${reviewDelete.length
                ? reviewDelete.map(
                    (item) => html`<div class="review-card" key=${item.id}>
                      <div>
                        <strong>${item.name}</strong>
                        <div class="small">${formatBytes(item.file?.size)}</div>
                      </div>
                      <div class="button-row">
                        <button class="btn ghost" onClick=${() => setActiveId(item.id)}>Anzeigen</button>
                        <button
                          class="btn keep"
                          onClick=${() =>
                            setItems((prev) =>
                              prev.map((i) => (i.id === item.id ? { ...i, status: 'keep' } : i))
                            )
                          }
                        >
                          Doch behalten
                        </button>
                      </div>
                    </div>`
                  )
                : html`<div class="alert">Noch keine Löschkandidaten markiert.</div>`}
            </div>
          </div>
          <div class="button-row">
            <button class="btn primary" onClick=${downloadZip} disabled=${isZipping || !stats.keep}>
              ${isZipping ? 'Zip wird erstellt…' : 'Behaltene als ZIP herunterladen'}
            </button>
            <button class="btn ghost" onClick=${() => goToNeighbor(1, 'any')} disabled=${!items.length}>
              Nächste Datei
            </button>
            <div class="alert"><strong>Status:</strong> ${statusMessage || 'Bereit.'}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

const rootElement = document.getElementById('root');
createRoot(rootElement).render(html`<${App} />`);
