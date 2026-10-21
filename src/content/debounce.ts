export interface DebouncedTask {
  trigger: () => void;
  cancel: () => void;
}

export function createDebounced(task: () => void, waitMs: number): DebouncedTask {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    trigger() {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        task();
      }, waitMs);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
