import type { Finding } from '../core/types.js';

export interface CollectorContext {
  rootDir: string;
  files: string[];                 // posix-style relative paths
  readText(rel: string): string;   // '' if unreadable
}

export interface Collector {
  name: string;
  collect(ctx: CollectorContext): Promise<Finding[]>;
}
