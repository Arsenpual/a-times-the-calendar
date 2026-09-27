import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PopupLayerContext = createContext(null);
const POPUP_REGIONS = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];
const DEFAULT_VISIBLE_ITEMS = 4;

function PopupRegion({ name, items }) {
  const [expanded, setExpanded] = useState(false);
  const orderedItems = [...items].sort((a, b) => b.priority - a.priority || a.order - b.order);
  const visibleItems = expanded ? orderedItems : orderedItems.slice(0, DEFAULT_VISIBLE_ITEMS);
  const hiddenCount = Math.max(0, orderedItems.length - visibleItems.length);

  if (orderedItems.length === 0) return null;

  return (
    <section className={`popup-layer__region popup-layer__region--${name}`} aria-label={`ข้อความลอย ${name}`}>
      <div className="popup-layer__stack">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className={`popup-layer__item${item.className ? ` ${item.className}` : ""}`}
            data-popup-priority={item.priority}
          >
            {item.content}
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button type="button" className="popup-layer__more" onClick={() => setExpanded(true)}>
          +{hiddenCount} รายการแจ้งเตือน
        </button>
      )}
      {expanded && orderedItems.length > DEFAULT_VISIBLE_ITEMS && (
        <button type="button" className="popup-layer__more" onClick={() => setExpanded(false)}>
          ยุบรายการ
        </button>
      )}
    </section>
  );
}

export function PopupLayerProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextOrder = useRef(0);

  const publish = useCallback((entry) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === entry.id);
      const next = { ...entry, order: existing?.order ?? nextOrder.current++ };
      return existing
        ? current.map((item) => item.id === entry.id ? next : item)
        : [...current, next];
    });
  }, []);

  const remove = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const contextValue = useMemo(() => ({ publish, remove }), [publish, remove]);

  return (
    <PopupLayerContext.Provider value={contextValue}>
      {children}
      {typeof document !== "undefined" && createPortal(
        <div className="popup-layer" aria-live="polite" aria-relevant="additions removals">
          {POPUP_REGIONS.map((region) => (
            <PopupRegion key={region} name={region} items={items.filter((item) => item.region === region)} />
          ))}
        </div>,
        document.body
      )}
    </PopupLayerContext.Provider>
  );
}

export function PopupLayerItem({ id, region = "top-right", priority = 0, className = "", children }) {
  const layer = useContext(PopupLayerContext);

  useEffect(() => {
    if (!layer || !id) return undefined;
    layer.publish({ id, region, priority, className, content: children });
    return () => layer.remove(id);
  }, [layer, id, region, priority, className, children]);

  // Isolated component previews/tests may render a feature without the app
  // provider. Keep the message visible in-place instead of silently dropping
  // it; the full app always portals it into the coordinated layer above.
  return layer ? null : children;
}
