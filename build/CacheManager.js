export class CacheManager {
    constructor(config = {}) {
        this.cache = new Map();
        this.stats = {
            totalEntries: 0,
            memoryUsage: 0,
            hits: 0,
            misses: 0,
            hitRate: 0,
            avgAccessTime: 0
        };
        // Set default configuration
        this.config = {
            maxEntries: config.maxEntries ?? 1000,
            maxMemory: config.maxMemory ?? 100 * 1024 * 1024, // 100MB default
            defaultTTL: config.defaultTTL ?? 3600, // 1 hour default
            checkInterval: config.checkInterval ?? 60 * 1000, // 1 minute default
            statsInterval: config.statsInterval ?? 30 * 1000 // 30 seconds default
        };
        // Start maintenance intervals
        this.cleanupInterval = setInterval(() => this.evictStale(), this.config.checkInterval);
        this.statsUpdateInterval = setInterval(() => this.updateStats(), this.config.statsInterval);
    }
    set(key, value, ttl) {
        const startTime = performance.now();
        // Calculate approximate size in bytes
        const size = this.calculateSize(value);
        // Check if adding this entry would exceed memory limit
        if (this.stats.memoryUsage + size > this.config.maxMemory) {
            this.enforceMemoryLimit(size);
        }
        const entry = {
            value,
            created: Date.now(),
            lastAccessed: Date.now(),
            ttl: ttl ?? this.config.defaultTTL,
            size
        };
        this.cache.set(key, entry);
        this.stats.totalEntries = this.cache.size;
        this.stats.memoryUsage += size;
        const endTime = performance.now();
        this.updateAccessTime(endTime - startTime);
    }
    get(key) {
        const startTime = performance.now();
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            this.updateHitRate();
            return undefined;
        }
        // Check if entry has expired
        if (this.isExpired(entry)) {
            this.delete(key);
            this.stats.misses++;
            this.updateHitRate();
            return undefined;
        }
        // Update last accessed time
        entry.lastAccessed = Date.now();
        this.stats.hits++;
        this.updateHitRate();
        const endTime = performance.now();
        this.updateAccessTime(endTime - startTime);
        return entry.value;
    }
    delete(key) {
        const entry = this.cache.get(key);
        if (entry) {
            this.stats.memoryUsage -= entry.size;
            this.cache.delete(key);
            this.stats.totalEntries = this.cache.size;
            return true;
        }
        return false;
    }
    clear() {
        this.cache.clear();
        this.resetStats();
    }
    getStats() {
        return { ...this.stats };
    }
    isExpired(entry) {
        return Date.now() > entry.created + (entry.ttl ?? this.config.defaultTTL) * 1000;
    }
    evictStale() {
        for (const [key, entry] of this.cache.entries()) {
            if (this.isExpired(entry)) {
                this.delete(key);
            }
        }
    }
    enforceMemoryLimit(requiredSize) {
        // Use LRU strategy to remove entries until we have enough space
        const entries = Array.from(this.cache.entries())
            .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
        while (this.stats.memoryUsage + requiredSize > this.config.maxMemory && entries.length > 0) {
            const [key] = entries.shift();
            this.delete(key);
        }
    }
    calculateSize(value) {
        // Rough estimation of memory usage in bytes
        const str = JSON.stringify(value);
        return str.length * 2; // Approximate UTF-16 encoding size
    }
    updateHitRate() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    }
    updateAccessTime(duration) {
        const total = this.stats.hits + this.stats.misses;
        this.stats.avgAccessTime =
            ((this.stats.avgAccessTime * (total - 1)) + duration) / total;
    }
    resetStats() {
        this.stats = {
            totalEntries: 0,
            memoryUsage: 0,
            hits: 0,
            misses: 0,
            hitRate: 0,
            avgAccessTime: 0
        };
    }
    updateStats() {
        // Additional periodic stats updates could be added here
        this.updateHitRate();
    }
    destroy() {
        if (this.cleanupInterval)
            clearInterval(this.cleanupInterval);
        if (this.statsUpdateInterval)
            clearInterval(this.statsUpdateInterval);
        this.clear();
    }
}
