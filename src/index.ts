#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CacheManager } from './CacheManager.js';
import fs from 'fs-extra';
import path from 'path';

class MemoryCacheServer {
  private server: Server;
  private cacheManager: CacheManager;

  constructor() {
    // Load configuration
    const configPath = process.env.CONFIG_PATH || path.join(process.cwd(), 'config.json');
    const config = fs.existsSync(configPath) 
      ? fs.readJsonSync(configPath)
      : {};
    
    // Allow environment variable overrides
    const finalConfig = {
      maxEntries: parseInt(process.env.MAX_ENTRIES as string) || config.maxEntries,
      maxMemory: parseInt(process.env.MAX_MEMORY as string) || config.maxMemory,
      defaultTTL: parseInt(process.env.DEFAULT_TTL as string) || config.defaultTTL,
      checkInterval: parseInt(process.env.CHECK_INTERVAL as string) || config.checkInterval,
      statsInterval: parseInt(process.env.STATS_INTERVAL as string) || config.statsInterval
    };

    this.server = new Server(
      {
        name: 'charly-memory-cache-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.cacheManager = new CacheManager(finalConfig);

    this.setupResourceHandlers();
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'cache://stats',
          name: 'Cache Statistics',
          mimeType: 'application/json',
          description: 'Real-time cache performance metrics',
        },
      ],
    }));

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      if (request.params.uri === 'cache://stats') {
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: 'application/json',
              text: JSON.stringify(this.cacheManager.getStats(), null, 2),
            },
          ],
        };
      }

      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown resource: ${request.params.uri}`
      );
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'store_data',
          description: 'Store data in the cache with optional TTL',
          inputSchema: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description: 'Unique identifier for the cached data',
              },
              value: {
                type: 'any',
                description: 'Data to cache',
              },
              ttl: {
                type: 'number',
                description: 'Time-to-live in seconds (optional)',
              },
            },
            required: ['key', 'value'],
          },
        },
        {
          name: 'retrieve_data',
          description: 'Retrieve data from the cache',
          inputSchema: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description: 'Key of the cached data to retrieve',
              },
            },
            required: ['key'],
          },
        },
        {
          name: 'clear_cache',
          description: 'Clear specific or all cache entries',
          inputSchema: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description: 'Specific key to clear (optional - clears all if not provided)',
              },
            },
          },
        },
        {
          name: 'get_cache_stats',
          description: 'Get cache statistics',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'store_data': {
            const { key, value, ttl } = request.params.arguments as {
              key: string;
              value: any;
              ttl?: number;
            };
            this.cacheManager.set(key, value, ttl);
            return {
              content: [
                {
                  type: 'text',
                  text: `Successfully stored data with key: ${key}`,
                },
              ],
            };
          }

          case 'retrieve_data': {
            const { key } = request.params.arguments as { key: string };
            const value = this.cacheManager.get(key);
            if (value === undefined) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No data found for key: ${key}`,
                  },
                ],
                isError: true,
              };
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(value, null, 2),
                },
              ],
            };
          }

          case 'clear_cache': {
            const { key } = request.params.arguments as { key?: string };
            if (key) {
              const success = this.cacheManager.delete(key);
              return {
                content: [
                  {
                    type: 'text',
                    text: success
                      ? `Successfully cleared cache entry: ${key}`
                      : `No cache entry found for key: ${key}`,
                  },
                ],
              };
            } else {
              this.cacheManager.clear();
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Successfully cleared all cache entries',
                  },
                ],
              };
            }
          }

          case 'get_cache_stats': {
            const stats = this.cacheManager.getStats();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(stats, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Memory Cache MCP server running on stdio');
  }

  async close() {
    this.cacheManager.destroy();
    await this.server.close();
  }
}

const server = new MemoryCacheServer();
server.run().catch(console.error);
