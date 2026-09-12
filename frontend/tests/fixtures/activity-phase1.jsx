import React, { useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../src/shared/i18n/i18n.jsx';
import ActivityModeWeekSpine from '../../src/features/activity/components/activity-mode-week-spine.jsx';
import '../../src/index.css';

const day = new Date(2026, 8, 7);
const timed = (id, offset, hour, duration = 2) => ({ id, summary: id, start: { dateTime: new Date(2026, 8, 7 + offset, hour).toISOString() }, end: { dateTime: new Date(2026, 8, 7 + offset, hour + duration).toISOString() } });
const initial = [{ ...timed('Activity A', 0, 9), recurringEventId: 'series-a' }, timed('Activity B', 1, 12), timed('Locked', 2, 9), { id: 'All day', summary: 'All day', start: { date: '2026-09-07' }, end: { date: '2026-09-08' } }];
window.phase1 = { calls: [], cycleActivities: initial, archive: [], set: null };
function Fixture() {
  const [activities, setActivities] = useState(initial);
  const [options, setOptions] = useState({ viewMode: 'week', anchorDate: day, userId: 'test-a', fullscreenRequestId: 0 });
  const returnToCycle = useRef(false);
  window.phase1.set = patch => setOptions(current => ({ ...current, ...patch }));
  const fullscreenChanged = useCallback(open => {
    if (!open && returnToCycle.current) {
      returnToCycle.current = false;
      setOptions(current => ({ ...current, viewMode: 'four-weeks' }));
    }
  }, []);
  const record = (type, value) => window.phase1.calls.push({ type, value });
  return <LanguageProvider><main style={{ padding: 20 }}>
    <ActivityModeWeekSpine {...options} activities={activities} categories={[]} activityCategoryMap={{}} activityTagMap={{}} lockedActivities={{ Locked: true }} calendarAccessToken="test-token" hoursPerCell={2}
      onTimelineFullscreenChange={fullscreenChanged}
      cycleData={{ activities, loading: false, error: "" }}
      onSelectOverviewWeek={date => setOptions(current => ({ ...current, anchorDate: date }))}
      onOpenOverviewWeekView={date => setOptions(current => ({ ...current, anchorDate: date, viewMode: 'week' }))}
      onOpenOverviewWeekEditor={date => { returnToCycle.current = true; setOptions(current => ({ ...current, anchorDate: date, viewMode: 'week', fullscreenRequestId: current.fullscreenRequestId + 1 })); }}
      onSaveTimes={async changes => { record('save', changes); if (window.phase1.holdSave) await new Promise(resolve => { window.phase1.releaseSave = resolve; }); setActivities(current => current.map(item => { const change = changes.find(c => c.id === item.id); return change ? { ...item, start: { dateTime: change.start.toISOString() }, end: { dateTime: change.end.toISOString() } } : item; })); return true; }}
      onEditActivity={item => record('edit', item.id)} onAddActivity={date => record('add', date)}
      onDuplicateActivity={async (item, dates) => { record('copy', { id: item.id, ...dates }); return { id: 'copied' }; }}
      onDeleteActivity={async id => { record('delete', id); setActivities(current => current.filter(item => item.id !== id)); return true; }}
      onMoveActivityToDay={async (id, date) => { record('move-day', { id, date }); return true; }}
    />
  </main></LanguageProvider>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture /></React.StrictMode>);
