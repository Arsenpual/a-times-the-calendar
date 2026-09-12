import React from "react";
import { weekNameKey, defaultWeekName } from "../hooks/use-week-names.js";

export default function WeekNameField({ weekStart, weekNames, editingWeekKey, weekNameDraft, onStartEditing, onDraftChange, onCommit, onCancel, className }) {
  const key = weekNameKey(weekStart);
  const name = weekNames[key] || defaultWeekName(weekStart);
  if (editingWeekKey === key) return <input
    className={`${className} is-editing`}
    value={weekNameDraft}
    autoFocus
    aria-label="ชื่อสัปดาห์"
    onClick={(event) => event.stopPropagation()}
    onChange={(event) => onDraftChange(event.target.value)}
    onBlur={onCommit}
    onKeyDown={(event) => {
      if (event.key === "Enter") event.currentTarget.blur();
      if (event.key === "Escape") { event.preventDefault(); onCancel(); }
    }}
  />;
  return <button type="button" className={className} onClick={(event) => { event.stopPropagation(); onStartEditing(weekStart); }} title="คลิกเพื่อตั้งชื่อสัปดาห์">{name}</button>;
}
