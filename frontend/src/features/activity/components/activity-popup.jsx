import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toDateInputValue } from "../../../shared/lib/date-utils.js";
import {
  previousActivityPopupMode,
  shouldWarnBeforeSeriesAction
} from "../lib/activity-popup-logic.js";
import {
  ActivityPopupHeader,
  ActivityPopupMenu,
  ActivityPopupModePanels
} from "./activity-popup-sections.jsx";

/**
 * Activity context popup orchestration. Presentation for each mode lives in
 * activity-popup-sections.jsx; this component owns transitions, async action
 * state and viewport-safe positioning.
 */
export default function ActivityPopup({
  activity,
  start,
  end,
  position,
  locked,
  categories,
  categoryId,
  tags,
  displayColor,
  onClose,
  onAssignCategory,
  onToggleLock,
  onEditActivity,
  onEditSeries,
  onDelete,
  onDeleteSeries,
  onSelectSeriesDrag,
  onDuplicate,
  onMoveToDay,
  onFetchSeriesCount,
  onArchive,
  restrictedToLock = false
}) {
  const popupRef = useRef(null);
  const [resolvedPosition, setResolvedPosition] = useState(position);
  const [mode, setMode] = useState("menu");
  const [busyAction, setBusyAction] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [moveDate, setMoveDate] = useState(() => toDateInputValue(start));
  const [pendingAction, setPendingAction] = useState(null);
  const [seriesCount, setSeriesCount] = useState(null);
  const [seriesCountLoading, setSeriesCountLoading] = useState(false);
  const [lockFeedback, setLockFeedback] = useState(null);

  const isRecurring = Boolean(activity.recurringEventId);
  const selectedCategory = categories.find((category) => category.id === categoryId);

  useLayoutEffect(() => {
    const resolvePosition = () => {
      const rect = popupRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 10;
      const gap = 10;
      const anchorX = position?.x ?? margin;
      const anchorY = position?.y ?? margin;
      const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
      const preferredX = anchorX + gap;
      const preferredY = anchorY + gap;
      const x = Math.max(
        margin,
        Math.min(preferredX + rect.width <= window.innerWidth - margin ? preferredX : anchorX - rect.width - gap, maxX)
      );
      const y = Math.max(
        margin,
        Math.min(preferredY + rect.height <= window.innerHeight - margin ? preferredY : anchorY - rect.height - gap, maxY)
      );
      setResolvedPosition((current) => current?.x === x && current?.y === y ? current : { x, y });
    };

    resolvePosition();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resolvePosition);
    if (popupRef.current && observer) observer.observe(popupRef.current);
    window.addEventListener("resize", resolvePosition);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resolvePosition);
    };
  }, [position?.x, position?.y, mode, restrictedToLock, actionError]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (mode === "menu") onClose?.();
      else setMode(previousActivityPopupMode(mode, isRecurring));
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mode, onClose, isRecurring]);

  const runQuickAction = async (key, action) => {
    setBusyAction(key);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDuplicate = () => runQuickAction("duplicate", async () => {
    await onDuplicate?.();
    onClose?.();
  });

  const handleOpenInGoogle = () => {
    if (activity.htmlLink) window.open(activity.htmlLink, "_blank", "noopener,noreferrer");
  };

  const handleToggleLock = async () => {
    setLockFeedback(locked ? "🔓" : "🔒");
    try {
      await onToggleLock?.(!locked);
    } finally {
      window.setTimeout(() => setLockFeedback(null), 700);
    }
  };

  const handleConfirmMove = () => runQuickAction("move", async () => {
    const moved = await onMoveToDay?.(moveDate);
    if (moved !== false) onClose?.();
  });

  const handleMoveToNextDay = () => runQuickAction("move-next-day", async () => {
    const nextDay = new Date(start);
    nextDay.setDate(nextDay.getDate() + 1);
    const moved = await onMoveToDay?.(toDateInputValue(nextDay));
    if (moved !== false) onClose?.();
  });

  const handleConfirmDelete = () => runQuickAction("delete", async () => {
    await onDelete?.();
    onClose?.();
  });

  const handleConfirmDeleteSeries = () => runQuickAction("delete-series", async () => {
    await onDeleteSeries?.();
    onClose?.();
  });

  const initiateRecurringAction = async (action) => {
    setPendingAction(action);
    setMode("recurring-action");
    setSeriesCount(null);
    setSeriesCountLoading(true);
    try {
      const count = await onFetchSeriesCount?.();
      setSeriesCount(count ?? null);
    } catch {
      // Unknown count uses the conservative warning path.
    } finally {
      setSeriesCountLoading(false);
    }
  };

  const handleActionThisOnly = () => {
    if (pendingAction === "delete") setMode("confirm-delete");
    else if (pendingAction === "edit") {
      onClose?.();
      onEditActivity?.();
    }
  };

  const handleActionSeries = () => {
    if (shouldWarnBeforeSeriesAction(seriesCount)) {
      setMode("series-limit-warning");
    } else if (pendingAction === "delete") {
      setMode("confirm-delete-series");
    } else if (pendingAction === "edit") {
      onClose?.();
      onEditSeries?.();
    }
  };

  const handleOverrideLimitAndProceed = () => {
    if (pendingAction === "delete") setMode("confirm-delete-series");
    else if (pendingAction === "edit") {
      onClose?.();
      onEditSeries?.();
    }
  };

  return (
    <div
      ref={popupRef}
      className={`activity-popup${restrictedToLock ? " activity-popup--lock-only" : ""}`}
      style={{ top: resolvedPosition?.y ?? position?.y ?? 8, left: resolvedPosition?.x ?? position?.x ?? 8 }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <ActivityPopupHeader
        activity={activity}
        start={start}
        end={end}
        displayColor={displayColor}
        locked={locked}
        isRecurring={isRecurring}
        tags={tags}
        onClose={onClose}
      />

      <ActivityPopupModePanels
        mode={mode}
        pendingAction={pendingAction}
        seriesCount={seriesCount}
        seriesCountLoading={seriesCountLoading}
        actionError={actionError}
        busyAction={busyAction}
        isRecurring={isRecurring}
        moveDate={moveDate}
        setMoveDate={setMoveDate}
        setMode={setMode}
        setPendingAction={setPendingAction}
        handleActionThisOnly={handleActionThisOnly}
        handleActionSeries={handleActionSeries}
        handleOverrideLimitAndProceed={handleOverrideLimitAndProceed}
        handleConfirmDelete={handleConfirmDelete}
        handleConfirmDeleteSeries={handleConfirmDeleteSeries}
        handleConfirmMove={handleConfirmMove}
      />

      {mode === "menu" && (
        <ActivityPopupMenu
          activity={activity}
          locked={locked}
          isRecurring={isRecurring}
          restrictedToLock={restrictedToLock}
          busyAction={busyAction}
          lockFeedback={lockFeedback}
          actionError={actionError}
          categories={categories}
          categoryId={categoryId}
          selectedCategory={selectedCategory}
          onAssignCategory={onAssignCategory}
          onClose={onClose}
          onEditActivity={onEditActivity}
          onSelectSeriesDrag={onSelectSeriesDrag}
          onArchive={onArchive}
          handleDuplicate={handleDuplicate}
          handleMoveToNextDay={handleMoveToNextDay}
          handleOpenInGoogle={handleOpenInGoogle}
          handleToggleLock={handleToggleLock}
          initiateRecurringAction={initiateRecurringAction}
          setMode={setMode}
        />
      )}
    </div>
  );
}
