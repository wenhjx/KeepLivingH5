/**
 * 日志工具
 * 统一日志输出格式，支持分级控制
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class LoggerClass {
  private level: LogLevel = LogLevel.INFO;
  private prefix = '[KeepLiving]';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.prefix, '[DEBUG]', ...args);
    }
  }

  info(...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.prefix, '[INFO]', ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.prefix, '[WARN]', ...args);
    }
  }

  error(...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.prefix, '[ERROR]', ...args);
    }
  }

  /** 性能计时开始 */
  time(label: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.time(`${this.prefix} ${label}`);
    }
  }

  /** 性能计时结束 */
  timeEnd(label: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.timeEnd(`${this.prefix} ${label}`);
    }
  }
}

export const Logger = new LoggerClass();
