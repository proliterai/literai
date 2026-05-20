import { writable, get } from 'svelte/store';

export type LogEntry = {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'error';
  direction: 'outgoing' | 'incoming';
  data: {
    url?: string;
    model?: string;
    messages?: any[];
    params?: Record<string, any>;
    response?: any;
    error?: string;
    statusCode?: number;
    duration?: number;
  };
};

type LoggingState = {
  entries: LogEntry[];
  maxEntries: number;
  isEnabled: boolean;
};

const initial: LoggingState = {
  entries: [],
  maxEntries: 100,
  isEnabled: true
};

function lid(): string {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createLoggingStore() {
  const store = writable<LoggingState>(initial);
  const { subscribe, update } = store;

  function addEntry(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    update((s) => {
      if (!s.isEnabled) return s;
      
      const newEntry: LogEntry = {
        ...entry,
        id: lid(),
        timestamp: nowIso()
      };
      
      const entries = [newEntry, ...s.entries].slice(0, s.maxEntries);
      return { ...s, entries };
    });
  }

  function logRequest(data: {
    url: string;
    model: string;
    messages: any[];
    params: Record<string, any>;
  }): string {
    const requestId = lid();
    addEntry({
      type: 'request',
      direction: 'outgoing',
      data: {
        url: data.url,
        model: data.model,
        messages: data.messages,
        params: data.params
      }
    });
    return requestId;
  }

  function logResponse(data: {
    response: any;
    statusCode?: number;
    duration?: number;
  }): void {
    addEntry({
      type: 'response',
      direction: 'incoming',
      data: {
        response: data.response,
        statusCode: data.statusCode,
        duration: data.duration
      }
    });
  }

  function logError(data: {
    error: string;
    statusCode?: number;
    url?: string;
  }): void {
    addEntry({
      type: 'error',
      direction: 'incoming',
      data: {
        error: data.error,
        statusCode: data.statusCode,
        url: data.url
      }
    });
  }

  function clear(): void {
    update((s) => ({ ...s, entries: [] }));
  }

  function toggle(): void {
    update((s) => ({ ...s, isEnabled: !s.isEnabled }));
  }

  function setMaxEntries(max: number): void {
    update((s) => ({
      ...s,
      maxEntries: Math.max(10, Math.min(500, max)),
      entries: s.entries.slice(0, max)
    }));
  }

  function exportLogs(): string {
    const s = get(store);
    return JSON.stringify({
      exportedAt: nowIso(),
      totalEntries: s.entries.length,
      entries: s.entries
    }, null, 2);
  }

  return {
    subscribe,
    logRequest,
    logResponse,
    logError,
    clear,
    toggle,
    setMaxEntries,
    exportLogs
  };
}

export const loggingStore = createLoggingStore();