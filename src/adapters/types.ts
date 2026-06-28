import type { Finding } from '../core/types.js';
import type { CollectorContext } from '../collectors/types.js';

export type ExecFn = (cmd: string, args: string[], cwd: string) => { stdout: string; status: number | null };

export interface Adapter {
  name: string;
  isApplicable(ctx: CollectorContext): boolean;
  run(ctx: CollectorContext, exec: ExecFn): Promise<Finding[]>;
}
