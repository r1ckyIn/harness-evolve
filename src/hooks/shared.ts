// Shared utilities for hook handlers: stdin reading and tool input summarization

const MAX_LEN = 200;

/**
 * Truncate a string to maxLen characters, appending '...' if truncated.
 */
function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

/**
 * Read all data from a readable stream into a string buffer.
 * Used for testability -- readStdin() delegates to this with process.stdin.
 */
export function readFromStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.setEncoding('utf-8');
    stream.on('data', (chunk: string) => {
      data += chunk;
    });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

/**
 * Read all stdin data into a string buffer.
 * Claude Code pipes JSON to hook stdin; this collects all chunks before parsing.
 */
export function readStdin(): Promise<string> {
  return readFromStream(process.stdin);
}

/**
 * Produce a concise summary of tool_input, capped at 200 characters.
 * Prevents Write/Edit tool inputs (with full file content) from bloating logs.
 */
export function summarizeToolInput(
  toolName: string,
  toolInput: Record<string, unknown>,
): string {
  switch (toolName) {
    case 'Bash':
      return truncate(String(toolInput.command ?? ''), MAX_LEN);
    case 'Write':
    case 'Edit':
    case 'Read':
      return truncate(String(toolInput.file_path ?? ''), MAX_LEN);
    case 'Glob':
      return truncate(String(toolInput.pattern ?? ''), MAX_LEN);
    case 'Grep':
      return truncate(String(toolInput.pattern ?? ''), MAX_LEN);
    default: {
      // MCP tools and others: stringify then truncate
      const str = JSON.stringify(toolInput);
      return truncate(str, MAX_LEN);
    }
  }
}
