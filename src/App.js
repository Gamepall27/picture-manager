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

function MediaCard({ item, onKeep, onRemove }) {
  return h(
    'article',
    { className: 'media-card' },
    h(
      'div',
      { className: 'media-thumb' },
      h(MediaPreview, { item }),
      h(
        'div',
        { className: 'chip-row' },
        h(Pill, {
          label: item.status === STATUS_REMOVE ? 'Zum Löschen vorgemerkt' : 'Behalten',
          tone: item.status === STATUS_REMOVE ? 'danger' : 'success',
        }),
        h('span', { className: 'meta-type' }, item.type || 'Unbekannt')
      )
    ),
    h(
      'div',
      { className: 'media-meta' },
      h('div', { className: 'media-name' }, item.name),
      h('div', { className: 'media-path' }, item.relativePath),
      h(
        'div',
        { className: 'meta-row' },
        h('span', { className: 'meta-size' }, formatBytes(item.size)),
        h('span', { className: 'meta-separator' }, '•'),
        h('span', { className: 'meta-id' }, item.id.slice(0, 8))
      )
    ),
    h(
      'div',
      { className: 'media-actions' },
      h(
        'button',
        {
          className: `action-btn ghost${item.status === STATUS_KEEP ? ' is-active' : ''}`,
          onClick: onKeep,
          type: 'button',
        },
        'Behalten'
      ),
      h(
        'button',
        {
          className: `action-btn danger${item.status === STATUS_REMOVE ? ' is-active' : ''}`,
          onClick: onRemove,
          type: 'button',
        },
        'Zum Löschen vormerken'
      )
    )
  );
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

function QueueItem({ item, onRestore }) {
  return h(
    'li',
    { className: 'queue-item' },
    h('div', { className: 'queue-main' }, item.relativePath),
    h(
      'div',
      { className: 'queue-meta' },
      h('span', null, formatBytes(item.size)),
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

  useEffect(() => {
    return () => {
      items.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    };
  }, [items]);

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

  const changeStatus = (id, status) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
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
  };

  const filteredItems =
    filter === 'remove'
      ? items.filter((item) => item.status === STATUS_REMOVE)
      : filter === 'keep'
        ? items.filter((item) => item.status === STATUS_KEEP)
        : items;

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
              { className: 'media-grid' },
              filteredItems.map((item) =>
                h(MediaCard, {
                  key: item.id,
                  item,
                  onKeep: () => changeStatus(item.id, STATUS_KEEP),
                  onRemove: () => changeStatus(item.id, STATUS_REMOVE),
                })
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
                  onRestore: () => changeStatus(item.id, STATUS_KEEP),
                })
              )
            )
      )
    )
  );
}
