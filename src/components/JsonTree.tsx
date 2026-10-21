import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { LIMITS } from '../shared/limits';
import { isRecord, safeStringify } from '../shared/json';
import { CopyButton } from './CopyButton';

interface JsonTreeProps {
  value: unknown;
  initialExpandDepth?: number;
}

export function JsonTree({ value, initialExpandDepth = 2 }: JsonTreeProps) {
  return (
    <div className="tree">
      <div className="tree-toolbar">
        <CopyButton text={safeStringify(value)} label="Copy JSON" />
      </div>
      <JsonNode value={value} label={null} depth={0} initialExpandDepth={initialExpandDepth} stack={[]} />
    </div>
  );
}

interface JsonNodeProps {
  value: unknown;
  label: string | null;
  depth: number;
  initialExpandDepth: number;
  stack: readonly object[];
}

function JsonNode({ value, label, depth, initialExpandDepth, stack }: JsonNodeProps) {
  if (Array.isArray(value)) {
    return (
      <Branch
        label={label}
        preview={`Array(${value.length})`}
        depth={depth}
        initialExpandDepth={initialExpandDepth}
        kind="array"
      >
        <PagedChildren
          items={value}
          render={(item, index) => (
            <JsonNode
              key={`${index}-${depth}`}
              value={item}
              label={String(index)}
              depth={depth + 1}
              initialExpandDepth={initialExpandDepth}
              stack={stack}
            />
          )}
        />
      </Branch>
    );
  }

  if (isPlainObject(value)) {
    if (stack.includes(value)) {
      return (
        <div className="tree-row">
          {label !== null ? <KeyName name={label} /> : null}
          <span className="tree-null">[Circular]</span>
        </div>
      );
    }
    const entries = Object.entries(value);
    const nextStack = [...stack, value];
    return (
      <Branch
        label={label}
        preview={`{${entries.length}}`}
        depth={depth}
        initialExpandDepth={initialExpandDepth}
        kind="object"
      >
        <PagedChildren
          items={entries}
          render={([key, child], index) => (
            <JsonNode
              key={`${key}-${index}`}
              value={child}
              label={key}
              depth={depth + 1}
              initialExpandDepth={initialExpandDepth}
              stack={nextStack}
            />
          )}
        />
      </Branch>
    );
  }

  return (
    <div className="tree-row">
      {label !== null ? <KeyName name={label} /> : null}
      <Primitive value={value} />
    </div>
  );
}

function Branch({
  label,
  preview,
  depth,
  initialExpandDepth,
  kind,
  children,
}: {
  label: string | null;
  preview: string;
  depth: number;
  initialExpandDepth: number;
  kind: 'object' | 'array';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(depth < initialExpandDepth);
  const capped = depth >= LIMITS.treeDisplayDepth;

  return (
    <div className="tree-branch">
      <button type="button" className="tree-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        {label !== null ? <KeyName name={label} /> : <span className="tree-kind">{kind}</span>}
        {!open ? <span className="tree-preview">{preview}</span> : null}
      </button>
      {open ? (
        capped ? (
          <p className="tree-note">
            Nested content continues beyond display depth {LIMITS.treeDisplayDepth}. Copy JSON to read the rest. The
            data is still included in export.
          </p>
        ) : (
          <div className="tree-children">{children}</div>
        )
      ) : null}
    </div>
  );
}

function PagedChildren<T>({ items, render }: { items: readonly T[]; render: (item: T, index: number) => ReactNode }) {
  const [count, setCount] = useState<number>(LIMITS.treePageSize);
  const visible = items.slice(0, count);
  return (
    <>
      {visible.map((item, index) => render(item, index))}
      {count < items.length ? (
        <button type="button" className="text-button" onClick={() => setCount((value) => value + LIMITS.treePageSize)}>
          Show {Math.min(LIMITS.treePageSize, items.length - count)} more ({items.length - count} hidden in this view)
        </button>
      ) : null}
    </>
  );
}

function KeyName({ name }: { name: string }) {
  return <span className="tree-key">{name}</span>;
}

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="tree-null">null</span>;
  if (typeof value === 'string') return <StringValue value={value} />;
  if (typeof value === 'number') return <span className="tree-number">{String(value)}</span>;
  if (typeof value === 'boolean') return <span className="tree-boolean">{String(value)}</span>;
  return <span className="tree-null">{typeof value}</span>;
}

function StringValue({ value }: { value: string }) {
  const [shown, setShown] = useState<number>(LIMITS.stringPreviewChars);
  const visible = value.length > shown ? value.slice(0, shown) : value;
  return (
    <span className="tree-string">
      "{visible}"
      {value.length > shown ? (
        <button type="button" className="text-button inline" onClick={() => setShown((count) => count + 2000)}>
          Show more ({(value.length - shown).toLocaleString('en-US')} characters hidden in this view)
        </button>
      ) : null}
    </span>
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
