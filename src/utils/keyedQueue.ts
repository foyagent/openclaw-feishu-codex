export class KeyedQueue {
  private readonly tails = new Map<string, Promise<unknown>>();

  enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const tail = this.tails.get(key) ?? Promise.resolve();
    const next = tail
      .catch(() => undefined)
      .then(task)
      .finally(() => {
        if (this.tails.get(key) === next) {
          this.tails.delete(key);
        }
      });

    this.tails.set(key, next);
    return next;
  }
}
