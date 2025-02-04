# Charly Memory Cache Server - Technical Documentation

Repository: git@github.com:ibproduct/charlymcpcacheserver.git

## Architecture Overview

### Core Components

1. **CacheManager**
   - In-memory storage using Map
   - LRU eviction strategy
   - TTL management
   - Memory usage tracking
   - Statistics collection

2. **MCP Server**
   - Tool registration
   - Resource endpoints
   - Request handling
   - Error management

### Data Structures

```typescript
interface CacheEntry {
  value: any;          // Cached data
  created: number;     // Creation timestamp
  lastAccessed: number;// Last access timestamp
  ttl?: number;        // Time-to-live in seconds
  size: number;        // Memory size estimation
}

interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgAccessTime: number;
}

interface CacheConfig {
  maxEntries?: number;
  maxMemory?: number;
  defaultTTL?: number;
  checkInterval?: number;
  statsInterval?: number;
}
```

## Implementation Details

### Memory Management

1. Size Calculation
```typescript
private calculateSize(value: any): number {
  const str = JSON.stringify(value);
  return str.length * 2; // UTF-16 encoding size
}
```

2. LRU Implementation
```typescript
private enforceMemoryLimit(requiredSize: number): void {
  const entries = Array.from(this.cache.entries())
    .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

  while (this.stats.memoryUsage + requiredSize > this.config.maxMemory 
         && entries.length > 0) {
    const [key] = entries.shift()!;
    this.delete(key);
  }
}
```

### MCP Integration

1. Tool Registration
```typescript
this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'store_data',
      description: 'Store data in cache',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'any' },
          ttl: { type: 'number' }
        },
        required: ['key', 'value']
      }
    }
    // ... other tools
  ]
}));
```

2. Resource Endpoints
```typescript
this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{
    uri: 'cache://stats',
    name: 'Cache Statistics',
    mimeType: 'application/json'
  }]
}));
```

## Performance Considerations

1. Memory Optimization
   - JSON.stringify for size estimation
   - LRU eviction for memory limits
   - Periodic cleanup of expired entries

2. Concurrency
   - Map operations are atomic
   - Stats updates are synchronized
   - Resource access is thread-safe

3. Error Handling
   - Graceful degradation on memory limits
   - Error propagation through MCP protocol
   - Automatic recovery mechanisms

## Development Guidelines

1. Code Style
   - TypeScript strict mode
   - Async/await for asynchronous operations
   - Private methods for internal logic
   - Clear error messages

2. Testing
   - Unit tests for CacheManager
   - Integration tests for MCP tools
   - Performance benchmarks
   - Memory leak detection

3. Documentation
   - TSDoc comments
   - Clear method signatures
   - Example usage
   - Error scenarios

## Future Development

1. Performance Enhancements
   - More accurate memory tracking
   - Optimized data serialization
   - Batch operations support

2. Feature Additions
   - Pattern-based cache invalidation
   - Cache warming strategies
   - Custom eviction policies

3. Monitoring
   - Detailed performance metrics
   - Debug logging system
   - Health check endpoints

4. Scaling
   - Multi-process support
   - Distributed caching
   - Cache synchronization
