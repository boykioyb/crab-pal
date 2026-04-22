import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface SetSessionLabelsArgs {
  sessionId?: string;
  labels: string[];
}

export async function handleSetSessionLabels(
  ctx: SessionToolContext,
  args: SetSessionLabelsArgs
): Promise<ToolResult> {
  if (!ctx.setSessionLabels) {
    return errorResponse('set_session_labels is not available in this context.');
  }

  try {
    let labels = args.labels;

    // Resolve display names → IDs, reject unknown or mistyped labels.
    // Supports valued entries (e.g. "priority::3") and surfaces per-entry
    // reasons so the caller can fix each rejection precisely (upstream #566).
    if (ctx.resolveLabels) {
      const { resolved, unknown, available, reasons } = ctx.resolveLabels(labels);
      if (unknown.length > 0) {
        const reasonList = unknown
          .map(u => `  - "${u}": ${reasons?.[u] ?? 'unknown label'}`)
          .join('\n');
        return errorResponse(
          `Rejected labels:\n${reasonList}\nAvailable label IDs: ${available.join(', ')}`
        );
      }
      labels = resolved;
    }

    await ctx.setSessionLabels(args.sessionId, labels);
    const target = args.sessionId ? `session ${args.sessionId}` : 'current session';
    return successResponse(
      labels.length === 0
        ? `Labels cleared on ${target}.`
        : `Labels set on ${target}: ${labels.join(', ')}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to set labels: ${message}`);
  }
}
