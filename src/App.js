import { createElement, Fragment, useEffect, useState } from './lib/mini-react.js';

const h = createElement;
const STATUS_KEEP = 'keep';
const STATUS_REMOVE = 'remove';

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, power);
  return `${value.toFixed(value >= 10 || value % 1 === 0 ? 0 : 1)} ${units[power]}`;
}

function Pill({ label, tone }) {
  return h('span', { className: `pill pill-${tone || 'neutral'}` }, label);
}

function StatCard({ label, value, tone, hint }) {
  return h(
    'div',
    { className: 'stat-card' },
    h('div', { className: 'stat-label' }, label),
    h('div', { className: `stat-value stat-${tone || 'neutral'}` }, value),
    hint ? h('div', { className: 'stat-hint' }, hint) : null
  );
}

function ToolbarButton({ label, active, onClick, tone }) {
  return h(
    'button',
    {
      className: `toolbar-btn${active ? ' active' : ''}${tone ? ` tone-${tone}` : ''}`,
      onClick,
    },
    label
  );
}

function MediaPreview({ item }) {
  const commonProps = {
    className: 'media-frame',
    src: item.previewUrl,
  };

  if (item.type && item.type.startsWith('video/')) {
    return h(
      'video',
      {
        ...commonProps,
        controls: true,
        preload: 'metadata',
        playsInline: true,
      },
      null
    );
  }

  return h('img', { ...commonProps, alt: item.name, loading: 'lazy' }, null);
}

function EmptyState({ title, description }) {
  return h(
    'div',
    { className: 'empty-state' },
    h('div', { className: 'empty-icon' }, '📂'),
    h('div', { className: 'empty-title' }, title),
    h('div', { className: 'empty-description' }, description)
  );
}

function QueueItem({ item, onRestore, onToggleExpand, expanded }) {
  return h(
    'li',
    {
      className: `queue-item${expanded ? ' is-expanded' : ''}`,
      onClick: onToggleExpand,
    },
    h(
      'div',
      { className: 'queue-thumb' },
      h(MediaPreview, { item })
    ),
    h(
      'div',
      { className: 'queue-meta' },
      h('div', { className: 'queue-path' }, item.relativePath),
      h('span', { className: 'queue-size' }, formatBytes(item.size)),
      h(
        'button',
        {
          className: 'queue-restore',
          onClick: onRestore,
          type: 'button',
        },
        'Behalten'
      )
    )
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [folderName, setFolderName] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedQueueId, setExpandedQueueId] = useState(null);

  useEffect(() => {
    return () => {
      items.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    };
  }, [items]);

  useEffect(() => {
    setCurrentIndex(0);
    setExpandedQueueId(null);
  }, [items.length]);

  const handleSelection = (event) => {
    const list = event?.target?.files;
    if (!list || list.length === 0) return;

    const accepted = Array.from(list).filter(
      (file) => file.type?.startsWith('image/') || file.type?.startsWith('video/')
    );

    if (accepted.length === 0) {
      setItems((prev) => {
        prev.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      setFolderName('');
      setFilter('all');
      event.target.value = '';
      return;
    }

    const mapped = accepted.map((file, index) => ({
      id: `${file.webkitRelativePath || file.name}-${file.lastModified}-${index}`,
      name: file.name,
      relativePath: file.webkitRelativePath || file.name,
      type: file.type || 'Unbekannt',
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      status: STATUS_KEEP,
    }));

    setItems((prev) => {
      prev.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
      return mapped;
    });

    const firstPath = accepted[0]?.webkitRelativePath || '';
    setFolderName(firstPath ? firstPath.split('/')[0] : 'Auswahl');
    setFilter('all');
    event.target.value = '';
  };

  const goToIndex = (nextIndex) => {
    setCurrentIndex((prev) => {
      const safeIndex = Math.max(0, Math.min(nextIndex, Math.max(items.length - 1, 0)));
      return items.length === 0 ? 0 : safeIndex;
    });
    setExpandedQueueId(null);
  };

  const goNext = () => {
    goToIndex(Math.min(items.length - 1, currentIndex + 1));
  };

  const goPrev = () => {
    goToIndex(Math.max(0, currentIndex - 1));
  };

  const changeStatus = (id, status, advance = false) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
    if (advance && items.length > 1) {
      goNext();
    }
  };

  const bulkMark = (status) => {
    setItems((prev) => prev.map((item) => ({ ...item, status })));
  };

  const handleReset = () => {
    setItems((prev) => {
      prev.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setFilter('all');
    setFolderName('');
    setCurrentIndex(0);
    setExpandedQueueId(null);
  };

  const filteredItems =
    filter === 'remove'
      ? items.filter((item) => item.status === STATUS_REMOVE)
      : filter === 'keep'
        ? items.filter((item) => item.status === STATUS_KEEP)
        : items;

  const currentItem = items[currentIndex];
  const removeQueue = items.filter((item) => item.status === STATUS_REMOVE);
  const keepCount = items.filter((item) => item.status === STATUS_KEEP).length;

  return h(
    Fragment,
    null,
    h(
      'header',
      { className: 'hero' },
      h('div', { className: 'hero__content' }, [
        h('p', { className: 'hero__eyebrow' }, 'Smartes Aufräumen'),
        h('h1', { className: 'hero__title' }, 'Bilder & Videos im Ordner prüfen'),
        h(
          'p',
          { className: 'hero__lead' },
          'Hänge einen kompletten Ordner an, prüfe die Vorschau und markiere Dateien zum späteren Löschen – sicher, schnell und übersichtlich.'
        ),
        h(
          'div',
          { className: 'hero__actions' },
          h(
            'label',
            { className: 'upload-label' },
            'Ordner auswählen',
            h('input', {
              type: 'file',
              webkitdirectory: true,
              directory: true,
              multiple: true,
              accept: 'image/*,video/*',
              onChange: handleSelection,
            })
          ),
          h(
            'button',
            {
              className: 'ghost-btn',
              type: 'button',
              onClick: handleReset,
              disabled: items.length === 0,
            },
            'Auswahl zurücksetzen'
          )
        ),
        h(
          'div',
          { className: 'hero__meta' },
          items.length > 0
            ? `Ausgewählter Ordner: ${folderName || '—'} • ${items.length} Medien`
            : 'Noch keine Auswahl getroffen'
        ),
      ])
    ),
    h(
      'main',
      { className: 'layout' },
      h(
        'section',
        { className: 'panel' },
        h('div', { className: 'panel__header' }, [
          h('div', null, [
            h('p', { className: 'section-eyebrow' }, 'Statusübersicht'),
            h('h2', { className: 'section-title' }, 'Behalten oder löschen?'),
          ]),
          items.length > 0
            ? h(
                'div',
                { className: 'toolbar' },
                [
                  h(ToolbarButton, {
                    label: 'Alle',
                    active: filter === 'all',
                    onClick: () => setFilter('all'),
                  }),
                  h(ToolbarButton, {
                    label: 'Behalten',
                    active: filter === 'keep',
                    onClick: () => setFilter('keep'),
                  }),
                  h(ToolbarButton, {
                    label: 'Zum Löschen vorgemerkt',
                    active: filter === 'remove',
                    onClick: () => setFilter('remove'),
                  }),
                  h('span', { className: 'toolbar__divider' }, ''),
                  h(ToolbarButton, {
                    label: 'Alle behalten',
                    tone: 'success',
                    onClick: () => bulkMark(STATUS_KEEP),
                  }),
                  h(ToolbarButton, {
                    label: 'Alle zum Löschen vormerken',
                    tone: 'danger',
                    onClick: () => bulkMark(STATUS_REMOVE),
                  }),
                ]
              )
            : null,
        ]),
        h(
          'div',
          { className: 'stat-grid' },
          [
            h(StatCard, {
              label: 'Gesamt',
              value: `${items.length}`,
              hint: folderName ? `Ordner: ${folderName}` : 'Noch keine Auswahl',
            }),
            h(StatCard, {
              label: 'Behalten',
              value: `${keepCount}`,
              tone: 'success',
              hint: keepCount === items.length && items.length > 0 ? 'Alles sauber' : 'Markiere störende Dateien',
            }),
            h(StatCard, {
              label: 'Löschliste',
              value: `${removeQueue.length}`,
              tone: 'danger',
              hint: removeQueue.length > 0 ? 'Vor endgültigem Löschen prüfen' : 'Noch nichts markiert',
            }),
          ]
        ),
        items.length === 0
          ? h(EmptyState, {
              title: 'Noch kein Ordner ausgewählt',
              description: 'Ziehe einen Ordner in das Auswahlfeld oder klicke auf „Ordner auswählen“, um die Vorschau zu laden.',
            })
          : h(
              'div',
              { className: 'viewer' },
              h(
                'div',
                { className: 'viewer__top' },
                h('div', { className: 'viewer__eyebrow' }, `${currentIndex + 1} / ${items.length}`),
                h('h3', { className: 'viewer__title' }, currentItem?.name || '—'),
                h('p', { className: 'viewer__path' }, currentItem?.relativePath || ''),
                currentItem
                  ? h(
                      'div',
                      { className: 'viewer__meta' },
                      h(Pill, {
                        label: currentItem.status === STATUS_REMOVE ? 'Zum Löschen vorgemerkt' : 'Behalten',
                        tone: currentItem.status === STATUS_REMOVE ? 'danger' : 'success',
                      }),
                      h('span', { className: 'viewer__size' }, formatBytes(currentItem.size)),
                      h('span', { className: 'viewer__type' }, currentItem.type || 'Unbekannt')
                    )
                  : null
              ),
              currentItem
                ? h(
                    'div',
                    { className: 'viewer__canvas' },
                    h(MediaPreview, { item: currentItem })
                  )
                : null,
              h(
                'div',
                { className: 'viewer__actions' },
                h(
                  'div',
                  { className: 'viewer__nav' },
                  h(
                    'button',
                    { className: 'nav-btn', onClick: goPrev, disabled: currentIndex === 0 },
                    '⟵ Zurück'
                  ),
                  h(
                    'button',
                    {
                      className: 'nav-btn',
                      onClick: goNext,
                      disabled: currentIndex >= items.length - 1,
                    },
                    'Weiter ⟶'
                  )
                ),
                h(
                  'div',
                  { className: 'viewer__decisions' },
                  h(
                    'button',
                    {
                      className: `action-btn ghost${currentItem?.status === STATUS_KEEP ? ' is-active' : ''}`,
                      onClick: () => changeStatus(currentItem.id, STATUS_KEEP, true),
                      type: 'button',
                    },
                    'Behalten'
                  ),
                  h(
                    'button',
                    {
                      className: `action-btn danger${currentItem?.status === STATUS_REMOVE ? ' is-active' : ''}`,
                      onClick: () => changeStatus(currentItem.id, STATUS_REMOVE, true),
                      type: 'button',
                    },
                    'Zum Löschen vormerken'
                  )
                )
              )
            )
      ),
      h(
        'section',
        { className: 'panel queue-panel' },
        h('div', { className: 'panel__header' }, [
          h('div', null, [
            h('p', { className: 'section-eyebrow' }, 'Kontrollblick'),
            h('h2', { className: 'section-title' }, 'Vorgemerkte Löschliste'),
          ]),
          h(Pill, {
            label: `${removeQueue.length} markiert`,
            tone: removeQueue.length > 0 ? 'danger' : 'neutral',
          }),
        ]),
        removeQueue.length === 0
          ? h(EmptyState, {
              title: 'Keine Dateien vorgemerkt',
              description: 'Markiere Dateien, um sie vor dem finalen Löschen noch einmal zu prüfen.',
            })
          : h(
              'ul',
              { className: 'queue-list' },
              removeQueue.map((item) =>
                h(QueueItem, {
                  key: item.id,
                  item,
                  expanded: expandedQueueId === item.id,
                  onToggleExpand: () =>
                    setExpandedQueueId((prev) => (prev === item.id ? null : item.id)),
                  onRestore: (event) => {
                    event.stopPropagation();
                    changeStatus(item.id, STATUS_KEEP);
                  },
                })
              )
            )
      )
    )
  );
}
