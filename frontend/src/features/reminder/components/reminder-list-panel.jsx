import ReminderComposer from "./reminder-composer.jsx";

/** Center dashboard presentation: heading, status tabs, composer, and filtered list. */
export default function ReminderListPanel({
  t, reminders, groups, typeOptions, daysOfWeek, lineColorOptions,
  activeTypeFilter, activeGroupFilter, onClearTypeFilter, onClearGroupFilter,
  enabledReminders, pausedReminders, completedReminders,
  visibleEnabledReminders, visiblePausedReminders, visibleCompletedReminders,
  statusTab, statusTabs, onStatusTabChange, isComposerOpen, onToggleComposer,
  composerProps, renderReminder, describeActiveFilters
}) {
  const emptyMessage = (status) => {
    const filters = describeActiveFilters();
    if (status === statusTabs.ENABLED) return filters ? t("reminder.emptyFilteredEnabled", { filters }) : t("reminder.emptyEnabled");
    if (status === statusTabs.PAUSED) return filters ? t("reminder.emptyFilteredPaused", { filters }) : t("reminder.emptyPaused");
    return filters ? t("reminder.emptyFilteredCompleted", { filters }) : t("reminder.emptyCompleted");
  };
  const activeList = statusTab === statusTabs.ENABLED
    ? visibleEnabledReminders
    : statusTab === statusTabs.PAUSED ? visiblePausedReminders : visibleCompletedReminders;
  const tabs = [
    [statusTabs.ENABLED, "enabled", t("reminder.enabled"), visibleEnabledReminders.length],
    [statusTabs.PAUSED, "paused", t("reminder.paused"), visiblePausedReminders.length],
    [statusTabs.COMPLETED, "completed", t("reminder.completed"), visibleCompletedReminders.length]
  ];

  return <section className="main-panel">
    <div className="main-panel-toolbar">
      <div>
        <h2>{t("reminder.allReminders")}
          {activeTypeFilter && <span className="active-filter-chip">{t(typeOptions.find((option) => option.type === activeTypeFilter)?.labelKey)}<button type="button" onClick={onClearTypeFilter} aria-label={t("reminder.clearTypeFilter")}>✕</button></span>}
          {activeGroupFilter && <span className="active-filter-chip">{groups.find((group) => group.id === activeGroupFilter)?.name}<button type="button" onClick={onClearGroupFilter} aria-label={t("reminder.clearGroupFilter")}>✕</button></span>}
        </h2>
        <p className="toolbar-subtitle">{t("reminder.summary", { total: reminders.length, enabled: enabledReminders.length, paused: pausedReminders.length, completed: completedReminders.length })}</p>
      </div>
      <button type="button" className={`add-reminder-btn ${isComposerOpen ? "is-open" : ""}`} onClick={onToggleComposer}><span className="add-reminder-btn-icon">+</span> {isComposerOpen ? t("reminder.closeForm") : t("reminder.addReminder")}</button>
    </div>
    <div className="tab-bar" role="tablist">
      {tabs.map(([value, className, label, count]) => <button key={value} type="button" role="tab" aria-selected={statusTab === value} className={`reminder-status-tab reminder-status-tab--${className} ${statusTab === value ? "is-active" : ""}`} onClick={() => onStatusTabChange(value)}>{label} <span className="reminder-status-tab-count">{count}</span></button>)}
    </div>
    <div className="reminders-scroll-area">
      <ReminderComposer {...composerProps} open={isComposerOpen} groups={groups} typeOptions={typeOptions} daysOfWeek={daysOfWeek} lineColorOptions={lineColorOptions} />
      {reminders.length === 0 && !isComposerOpen ? <p className="empty-state">{t("reminder.empty")}</p> : activeList.length > 0 ? activeList.map(renderReminder) : (!isComposerOpen || statusTab === statusTabs.COMPLETED) && <p className="empty-state">{emptyMessage(statusTab)}</p>}
    </div>
  </section>;
}
