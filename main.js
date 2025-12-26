import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";

const STATUS = {
  PENDING: "pending",
  KEEP: "keep",
  TRASH: "trash",
};

const statusLabels = {
  [STATUS.PENDING]: "Unentschieden",
  [STATUS.KEEP]: "Behalten",
  [STATUS.TRASH]: "Papierkorb",
};

const statusColors = {
  [STATUS.PENDING]: "#f3b567",
  [STATUS.KEEP]: "#5cb38d",
  [STATUS.TRASH]: "#e26d6d",
};

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function Tag({ label, tone }) {
  return (
    <span className="pill" style={{ backgroundColor: tone }}>
      {label}
    </span>
  );
}

function StatsBar({ files }) {
  const totals = useMemo(() => {
    return files.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { [STATUS.PENDING]: 0, [STATUS.KEEP]: 0, [STATUS.TRASH]: 0 }
    );
  }, [files]);

  const total = files.length || 1;

  return (
    <div className="stats">
      {[STATUS.PENDING, STATUS.KEEP, STATUS.TRASH].map((key) => (
        <div key={key} className="stat">
          <div className="stat-label">
            {statusLabels[key]}
            <Tag label={totals[key]} tone={statusColors[key]} />
          </div>
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${(totals[key] / total) * 100}%`, backgroundColor: statusColors[key] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterBar({ active, onChange, showTrashOnly, setShowTrashOnly }) {
  const filters = [
    { id: "all", label: "Alle" },
    { id: STATUS.PENDING, label: "Unentschieden" },
    { id: STATUS.KEEP, label: "Behalten" },
    { id: STATUS.TRASH, label: "Papierkorb" },
  ];

  return (
    <div className="filter-bar">
      <div className="filter-buttons">
        {filters.map((filter) => (
          <button
            key={filter.id}
            className={`ghost-btn ${active === filter.id ? "is-active" : ""}`}
            onClick={() => onChange(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={showTrashOnly}
          onChange={(e) => setShowTrashOnly(e.target.checked)}
        />
        Nur Papierkorb zeigen
      </label>
    </div>
  );
}

function FileCard({ item, onKeep, onTrash, onRestore }) {
  const isImage = item.file.type.startsWith("image/");
  const isVideo = item.file.type.startsWith("video/");

  return (
    <article className={`card status-${item.status}`}>
      <div className="thumb">
        {isImage && <img src={item.url} alt={item.name} loading="lazy" />}
        {isVideo && (
          <video src={item.url} controls preload="metadata" muted playsInline />
        )}
        {!isImage && !isVideo && <div className="placeholder">Keine Vorschau</div>}
      </div>
      <div className="card-body">
        <div className="card-header">
          <div>
            <p className="path">{item.path}</p>
            <p className="meta">
              {formatBytes(item.size)} · {item.file.type || "Unbekannter Typ"}
            </p>
          </div>
          <Tag label={statusLabels[item.status]} tone={statusColors[item.status]} />
        </div>
        <div className="actions">
          <button className="solid-btn" onClick={() => onKeep(item.id)}>
            Behalten
          </button>
          <button className="outline-btn" onClick={() => onTrash(item.id)}>
            In den Papierkorb
          </button>
          {item.status === STATUS.TRASH && (
            <button className="ghost-btn" onClick={() => onRestore(item.id)}>
              Wiederherstellen
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function TrashList({ files, onRestore }) {
  if (files.length === 0) {
    return (
      <div className="empty">
        <p>Der Papierkorb ist leer. Markiere Dateien, die du entfernen möchtest.</p>
      </div>
    );
  }
  return (
    <ul className="trash-list">
      {files.map((file) => (
        <li key={file.id}>
          <div>
            <p className="path">{file.path}</p>
            <p className="meta">{formatBytes(file.size)}</p>
          </div>
          <button className="ghost-btn" onClick={() => onRestore(file.id)}>
            Wiederherstellen
          </button>
        </li>
      ))}
    </ul>
  );
}

function App() {
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showTrashOnly, setShowTrashOnly] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      files.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [files]);

  const filteredFiles = useMemo(() => {
    const base = filter === "all" ? files : files.filter((item) => item.status === filter);
    if (showTrashOnly) return base.filter((item) => item.status === STATUS.TRASH);
    return base;
  }, [files, filter, showTrashOnly]);

  const trashItems = useMemo(() => files.filter((item) => item.status === STATUS.TRASH), [files]);

  const handleFolderChange = (event) => {
    const list = Array.from(event.target.files || []);
    if (list.length === 0) return;
    const accepted = list.filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("video/")
    );
    const mapped = accepted.map((file) => {
      const path = file.webkitRelativePath || file.name;
      return {
        id: `${path}-${file.lastModified}-${file.size}`,
        name: file.name,
        path,
        size: file.size,
        file,
        url: URL.createObjectURL(file),
        status: STATUS.PENDING,
      };
    });

    setFiles((prev) => {
      const existing = new Set(prev.map((item) => item.id));
      const merged = [...prev];
      mapped.forEach((item) => {
        if (!existing.has(item.id)) {
          merged.push(item);
        }
      });
      return merged;
    });

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const markKeep = (id) => {
    setFiles((prev) => prev.map((item) => (item.id === id ? { ...item, status: STATUS.KEEP } : item)));
  };

  const markTrash = (id) => {
    setFiles((prev) => prev.map((item) => (item.id === id ? { ...item, status: STATUS.TRASH } : item)));
  };

  const restore = (id) => {
    setFiles((prev) => prev.map((item) => (item.id === id ? { ...item, status: STATUS.PENDING } : item)));
  };

  const clearAll = () => {
    setFiles((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
  };

  const markAllTrash = () => {
    setFiles((prev) => prev.map((item) => ({ ...item, status: STATUS.TRASH })));
  };

  const markAllKeep = () => {
    setFiles((prev) => prev.map((item) => ({ ...item, status: STATUS.KEEP })));
  };

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Medien-Detox</p>
          <h1>Ordner durchsehen, Fotos aussortieren</h1>
          <p className="lede">
            Hänge einen Ordner mit sehr vielen Bildern und Videos an. Durchsuche die Vorschau,
            markiere störende Medien für den Papierkorb und behalte den Rest. Vor dem endgültigen
            Löschen kannst du den Papierkorb noch einmal prüfen.
          </p>
          <div className="upload">
            <label className="file-input">
              <input
                ref={inputRef}
                type="file"
                webkitdirectory=""
                mozdirectory=""
                directory=""
                multiple
                onChange={handleFolderChange}
              />
              <span>Ordner auswählen</span>
            </label>
            <div className="upload-actions">
              <button className="ghost-btn" onClick={clearAll}>
                Liste leeren
              </button>
              <button className="ghost-btn" onClick={markAllKeep}>
                Alles behalten
              </button>
              <button className="ghost-btn" onClick={markAllTrash}>
                Alles in Papierkorb
              </button>
            </div>
          </div>
        </div>
        <div className="panel">
          <h2>Überblick</h2>
          <p>Importierte Dateien: {files.length}</p>
          <p>Papierkorb: {trashItems.length}</p>
          <p>Behalten: {files.filter((f) => f.status === STATUS.KEEP).length}</p>
        </div>
      </header>

      <StatsBar files={files} />
      <FilterBar
        active={filter}
        onChange={setFilter}
        showTrashOnly={showTrashOnly}
        setShowTrashOnly={setShowTrashOnly}
      />

      <main className="layout">
        <section className="gallery" aria-label="Dateivorschau">
          {filteredFiles.length === 0 ? (
            <div className="empty">
              <p>Keine Dateien in dieser Ansicht. Lade einen Ordner oder ändere die Filter.</p>
            </div>
          ) : (
            <div className="grid">
              {filteredFiles.map((item) => (
                <FileCard
                  key={item.id}
                  item={item}
                  onKeep={markKeep}
                  onTrash={markTrash}
                  onRestore={restore}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="sidebar" aria-label="Papierkorb">
          <div className="sidebar-header">
            <div>
              <p className="eyebrow">Papierkorb</p>
              <h2>Zur Überprüfung</h2>
              <p className="small">Hier landen alle Dateien, die du löschen möchtest.</p>
            </div>
            <Tag label={trashItems.length} tone={statusColors[STATUS.TRASH]} />
          </div>
          <TrashList files={trashItems} onRestore={restore} />
        </aside>
      </main>
    </div>
  );
}

const container = document.getElementById("root");
createRoot(container).render(<App />);
