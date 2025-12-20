// A simple event emitter to broadcast Firestore permission errors.
// This allows us to decouple the error source from the error handling logic.

type EventMap = {
  'permission-error': (error: Error) => void;
};

class EventEmitter<T extends EventMap> {
  private listeners: { [K in keyof T]?: Array<T[K]> } = {};

  on<K extends keyof T>(event: K, listener: T[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
    }
  }
}

export const errorEmitter = new EventEmitter<EventMap>();
