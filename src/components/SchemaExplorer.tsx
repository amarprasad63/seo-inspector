import { useMemo, useState } from 'react';
import { LIMITS } from '../shared/limits';
import type { SchemaEntity } from '../shared/types';
import { entityMatches, entitySeverity } from '../utils/filter';
import type { Finding } from '../validation/types';
import { JsonTree } from './JsonTree';

interface SchemaExplorerProps {
  entities: readonly SchemaEntity[];
  findings: readonly Finding[];
  query: string;
  initialExpandDepth: number;
}

export function SchemaExplorer({ entities, findings, query, initialExpandDepth }: SchemaExplorerProps) {
  const filtered = useMemo(
    () => entities.filter((entity) => entityMatches(entity, query.trim().toLowerCase())),
    [entities, query],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(LIMITS.listPageSize);
  const selected = filtered.find((entity) => entity.id === selectedId) ?? filtered[0] ?? null;
  const visible = filtered.slice(0, visibleCount);

  if (entities.length === 0) {
    return <p className="empty-copy">No typed entities were found. Entities are objects that include @type.</p>;
  }

  if (filtered.length === 0) {
    return <p className="empty-copy">No entities match this search.</p>;
  }

  return (
    <div className="explorer">
      <ul className="entity-list" aria-label="Schema entities">
        {visible.map((entity) => {
          const status = entitySeverity(entity, findings);
          const active = selected?.id === entity.id;
          return (
            <li key={entity.id}>
              <button
                type="button"
                className={active ? 'entity-button active' : 'entity-button'}
                onClick={() => setSelectedId(entity.id)}
              >
                <span className={`status-dot status-${status}`} aria-hidden="true" />
                <span className="entity-type">{entity.types.join(' + ') || 'Untyped'}</span>
                <span className="entity-meta">
                  Script {entity.scriptIndex} · {entity.path}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {visibleCount < filtered.length ? (
        <button type="button" className="text-button" onClick={() => setVisibleCount((count) => count + LIMITS.listPageSize)}>
          Show more entities ({filtered.length - visibleCount} remaining)
        </button>
      ) : null}
      {selected ? (
        <div className="entity-detail">
          <div className="detail-heading">
            <h2>{selected.types.join(' + ')}</h2>
            <p title={selected.path}>
              Script {selected.scriptIndex} · {selected.path}
            </p>
          </div>
          <JsonTree key={selected.id} value={selected.value} initialExpandDepth={initialExpandDepth} />
        </div>
      ) : null}
    </div>
  );
}
