export interface CacheEntry {
  value: any;
  created: number;
  lastAccessed: number;
  ttl?: number;
  size: number;
}

export interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgAccessTime: number;
}

export interface CacheConfig {
  maxEntries?: number;
  maxMemory?: number;
  defaultTTL?: number;
  checkInterval?: number;
  statsInterval?: number;
}
