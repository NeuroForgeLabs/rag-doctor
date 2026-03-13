/**
 * ANSI escape codes for terminal color output.
 * These are intentionally kept minimal to avoid pulling in a color library.
 */
export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgGreen: "\x1b[42m",
} as const;

export function bold(s: string): string {
  return `${ANSI.bold}${s}${ANSI.reset}`;
}

export function dim(s: string): string {
  return `${ANSI.dim}${s}${ANSI.reset}`;
}

export function red(s: string): string {
  return `${ANSI.red}${s}${ANSI.reset}`;
}

export function yellow(s: string): string {
  return `${ANSI.yellow}${s}${ANSI.reset}`;
}

export function green(s: string): string {
  return `${ANSI.green}${s}${ANSI.reset}`;
}

export function cyan(s: string): string {
  return `${ANSI.cyan}${s}${ANSI.reset}`;
}
