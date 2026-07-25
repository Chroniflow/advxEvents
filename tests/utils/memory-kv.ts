interface StoredValue {
  value: string;
  expiration?: number;
}

export class MemoryKv {
  private readonly values = new Map<string, StoredValue>();

  async get(key: string, type?: "text" | "json") {
    const stored = this.values.get(key);
    if (!stored) return null;
    return type === "json" ? JSON.parse(stored.value) : stored.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    this.values.set(key, {
      value,
      expiration: options?.expirationTtl
        ? Date.now() + options.expirationTtl * 1_000
        : undefined,
    });
  }

  async delete(key: string) {
    this.values.delete(key);
  }

  async list(options: { prefix?: string; cursor?: string; limit?: number } = {}) {
    const keys = [...this.values.keys()]
      .filter((key) => key.startsWith(options.prefix ?? ""))
      .sort()
      .slice(0, options.limit ?? 1_000)
      .map((name) => ({ name }));
    return { keys, list_complete: true, cacheStatus: null };
  }
}
