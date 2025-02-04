import { CacheStats, CacheConfig } from './types.js';
export declare class CacheManager {
    private cache;
    private stats;
    private config;
    private cleanupInterval;
    private statsUpdateInterval;
    constructor(config?: CacheConfig);
    set(key: string, value: any, ttl?: number): void;
    get(key: string): any;
    delete(key: string): boolean;
    clear(): void;
    getStats(): CacheStats;
    private isExpired;
    private evictStale;
    private enforceMemoryLimit;
    private calculateSize;
    private updateHitRate;
    private updateAccessTime;
    private resetStats;
    private updateStats;
    destroy(): void;
}
