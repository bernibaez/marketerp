export interface RemoteSearchState {
  query: string;
  results: any[];
}

export interface POSSearchStore {
  getQuery: () => string;
  setQuery: (next: string) => void;
  getRemoteState: () => RemoteSearchState;
  setRemoteResults: (query: string, results: any[]) => void;
  subscribe: (listener: () => void) => () => void;
}

const EMPTY_REMOTE_STATE: RemoteSearchState = { query: '', results: [] };

export function createPOSSearchStore(initialQuery = ''): POSSearchStore {
  let query = initialQuery;
  let remoteState: RemoteSearchState = EMPTY_REMOTE_STATE;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getQuery: () => query,
    setQuery: (next: string) => {
      if (next === query) return;
      query = next;
      if (!next.trim() && remoteState !== EMPTY_REMOTE_STATE) {
        remoteState = EMPTY_REMOTE_STATE;
      }
      notify();
    },
    getRemoteState: () => remoteState,
    setRemoteResults: (targetQuery: string, results: any[]) => {
      const cleanQuery = targetQuery.trim().toLowerCase();
      if (!cleanQuery || results.length === 0) {
        if (remoteState === EMPTY_REMOTE_STATE) return;
        remoteState = EMPTY_REMOTE_STATE;
        notify();
        return;
      }
      remoteState = { query: cleanQuery, results };
      notify();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
