import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogContext = Record<string, unknown>;

@Injectable({
  providedIn: 'root'
})
export class LoggerService {

  private readonly minLevel: LogLevel = environment.production
    ? 'WARN'
    : 'DEBUG';

  private readonly levelPriority: Record<LogLevel, number> = {
    'DEBUG': 0,
    'INFO':  1,
    'WARN':  2,
    'ERROR': 3
  };

  debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('WARN', message, context);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    this.log('ERROR', message, context, error);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown
  ): void {

    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;

    switch (level) {
      case 'DEBUG':
        console.debug(prefix, message, context ?? '');
        break;

      case 'INFO':
        console.info(prefix, message, context ?? '');
        break;

      case 'WARN':
        console.warn(prefix, message, context ?? '');
        break;

      case 'ERROR':
        console.error(prefix, message, context ?? '', error ?? '');
        break;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }
}