export const createTimeChangeState = () => ({ pending: new Map(), past: [], future: [] });

const sameTime = (a, b) => a && b && +a.start === +b.start && +a.end === +b.end;

export function timeChangeReducer(state, action) {
  switch (action.type) {
    case "queue": {
      const pending = new Map(state.pending);
      for (const { id, start, end } of action.changes) {
        const value = { start: new Date(start), end: new Date(end) };
        if (!sameTime(pending.get(id), value)) pending.set(id, value);
      }
      if ([...pending].every(([id, value]) => value === state.pending.get(id))) return state;
      return { pending, past: [...state.past, state.pending], future: [] };
    }
    case "undo":
      return state.past.length ? { pending: state.past.at(-1), past: state.past.slice(0, -1), future: [state.pending, ...state.future] } : state;
    case "redo":
      return state.future.length ? { pending: state.future[0], past: [...state.past, state.pending], future: state.future.slice(1) } : state;
    case "discard": return createTimeChangeState();
    case "saved": {
      const pending = new Map(state.pending);
      for (const [id, value] of action.submitted) {
        if (pending.get(id) === value) pending.delete(id);
      }
      return { pending, past: [], future: [] };
    }
    default: return state;
  }
}
