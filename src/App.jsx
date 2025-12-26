import React, { useEffect, useMemo, useState } from 'react';

const statusLabels = {
  pending: 'Unentschieden',
  keep: 'Behalten',
  trash: 'Papierkorb'
};

const readableDate = (timestamp) =>
  new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(timestamp);

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const createEntry = (file, index) => ({
  id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
  file,
  previewUrl: URL.createObjectURL(file),
  status: 'pending'
});

const isImage = (type) => type.startsWith('image/');
const isVideo = (type) => type.startsWith('video/');

function App() {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [search, setSearch] = useState('');

  const cleanupPreviews = (items) => {
    items.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  };

  const handleFolderSelect = (event) => {
    const fileList = event.target.files;
    if (!fileList?.length) return;

    const mediaFiles = Array.from(fileList).filter((file) =>
      isImage(file.type) || isVideo(file.type)
    );

    setEntries((previous) => {
      cleanupPreviews(previous);
      return mediaFiles.map((file, index) => createEntry(file, index));
    });
  };

  const handleStatusChange = (id, nextStatus) => {
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
    );
  };

  const handleBulk = (nextStatus) => {
    setEntries((prev) =>
      prev.map((item) =>
        filter === 'all' || filter === item.status
          ? { ...item, status: nextStatus }
          : item
      )
    );
  };

  const exportTrashList = () => {
    const trashItems = entries.filter((entry) => entry.status === 'trash');
    const payload = trashItems.map((item) => ({
      name: item.file.name,
      size: item.file.size,
      modified: item.file.lastModified
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'papierkorb-liste.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      const matchesStatus = filter === 'all' || item.status === filter;
      const matchesSearch = item.file.name.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [entries, filter, search]);

  const sortedEntries = useMemo(() => {
    const sorted = [...filteredEntries];
    sorted.sort((a, b) => {
      if (sortBy === 'name') return a.file.name.localeCompare(b.file.name);
      if (sortBy === 'size') return b.file.size - a.file.size;
      if (sortBy === 'date') return b.file.lastModified - a.file.lastModified;
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });
    return sorted;
  }, [filteredEntries, sortBy]);

  const stats = useMemo(() => {
    return entries.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { pending: 0, keep: 0, trash: 0 }
    );
  }, [entries]);

  useEffect(
    () => () => {
      cleanupPreviews(entries);
    },
    [entries]
  );

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Massenhafte Bilder & Videos aussortieren</p>
          <h1>Ordner sichten, markieren, aufräumen</h1>
          <p className="lede">
            Wähle einen kompletten Ordner mit extrem vielen Bildern oder Videos aus. Alles wird
            in einer schnellen Vorschau angezeigt, damit du zwischen Behalten und Papierkorb
            unterscheiden kannst, bevor etwas endgültig gelöscht wird.
          </p>
          <div className="actions">
            <label className="primary">
              📂 Ordner auswählen
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                webkitdirectory=""
                directory=""
                onChange={handleFolderSelect}
              />
            </label>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setEntries([]);
                setSearch('');
              }}
            >
              Reset
            </button>
          </div>
          <p className="note">
            Dateien werden nicht gelöscht. Einträge mit Status „Papierkorb“ bleiben markiert, damit
            du sie vor dem endgültigen Löschen noch einmal kontrollieren kannst.
          </p>
        </div>
        <div className="stats">
          <div className="stat-card">
            <p>Gesamt</p>
            <strong>{entries.length}</strong>
          </div>
          <div className="stat-card pending">
            <p>Unentschieden</p>
            <strong>{stats.pending}</strong>
          </div>
          <div className="stat-card keep">
            <p>Behalten</p>
            <strong>{stats.keep}</strong>
          </div>
          <div className="stat-card trash">
            <p>Papierkorb</p>
            <strong>{stats.trash}</strong>
          </div>
        </div>
      </header>

      <section className="toolbar">
        <div className="filters">
          <button
            type="button"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            Alles
          </button>
          <button
            type="button"
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            Unentschieden
          </button>
          <button
            type="button"
            className={filter === 'keep' ? 'active' : ''}
            onClick={() => setFilter('keep')}
          >
            Behalten
          </button>
          <button
            type="button"
            className={filter === 'trash' ? 'active' : ''}
            onClick={() => setFilter('trash')}
          >
            Papierkorb
          </button>
        </div>
        <div className="search-group">
          <input
            type="search"
            placeholder="Dateiname durchsuchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="name">Name A-Z</option>
            <option value="date">Neuste zuerst</option>
            <option value="size">Größe</option>
            <option value="status">Status</option>
          </select>
          <button type="button" className="ghost" onClick={exportTrashList} disabled={!stats.trash}>
            🗑️ Export Papierkorb-Liste
          </button>
        </div>
      </section>

      <section className="bulk">
        <div>
          <p className="label">Sammelaktionen</p>
          <p className="hint">Wirken auf die aktuelle Filteransicht.</p>
        </div>
        <div className="bulk-buttons">
          <button type="button" onClick={() => handleBulk('keep')} disabled={!filteredEntries.length}>
            Alles behalten
          </button>
          <button type="button" onClick={() => handleBulk('trash')} disabled={!filteredEntries.length}>
            Alles in den Papierkorb
          </button>
          <button type="button" onClick={() => handleBulk('pending')} disabled={!filteredEntries.length}>
            Alles zurückstellen
          </button>
        </div>
      </section>

      <section className="grid" aria-label="Medienvorschau">
        {sortedEntries.length === 0 ? (
          <div className="empty">
            <p>Wähle einen Ordner, um Bilder und Videos zu sehen.</p>
          </div>
        ) : (
          sortedEntries.map((item) => (
            <article key={item.id} className={`card ${item.status}`}>
              <div className="preview">
                {isVideo(item.file.type) ? (
                  <video src={item.previewUrl} controls preload="metadata" />
                ) : (
                  <img src={item.previewUrl} alt={item.file.name} loading="lazy" />
                )}
              </div>
              <div className="meta">
                <div>
                  <p className="filename" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <p className="details">
                    {formatBytes(item.file.size)} • {readableDate(item.file.lastModified)}
                  </p>
                </div>
                <div className="status-chip">{statusLabels[item.status]}</div>
              </div>
              <div className="card-actions">
                <button
                  type="button"
                  className={item.status === 'keep' ? 'solid' : ''}
                  onClick={() => handleStatusChange(item.id, 'keep')}
                >
                  Behalten
                </button>
                <button
                  type="button"
                  className={item.status === 'pending' ? 'solid' : ''}
                  onClick={() => handleStatusChange(item.id, 'pending')}
                >
                  Offen
                </button>
                <button
                  type="button"
                  className={item.status === 'trash' ? 'danger' : 'outline-danger'}
                  onClick={() => handleStatusChange(item.id, 'trash')}
                >
                  Papierkorb
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export default App;
