const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

export class Logger {
  constructor({ level = "info", destination = process.stdout, prefix = "" } = {}) {
    this.level = LOG_LEVELS[level] ?? LOG_LEVELS.info;
    this.destination = destination;
    this.prefix = prefix;
  }

  debug(message, fields = {}) {
    this._write("debug", message, fields);
  }

  info(message, fields = {}) {
    this._write("info", message, fields);
  }

  warn(message, fields = {}) {
    this._write("warn", message, fields);
  }

  error(message, fields = {}) {
    this._write("error", message, fields);
  }

  child(prefix) {
    return new Logger({
      level: Object.keys(LOG_LEVELS)[this.level],
      destination: this.destination,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix
    });
  }

  _write(level, message, fields) {
    if (LOG_LEVELS[level] < this.level) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...fields
    };

    if (this.prefix) {
      entry.logger = this.prefix;
    }

    const line = JSON.stringify(entry);
    this.destination.write(line + "\n");
  }
}

export function createLogger(options = {}) {
  const level = options.level || process.env.LOG_LEVEL || "info";
  return new Logger({ ...options, level });
}
