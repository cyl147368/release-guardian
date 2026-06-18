import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "data", "seed.json");

export class Repository {
  constructor(filePath = DATA_PATH) {
    this.filePath = filePath;
    this._writeQueue = Promise.resolve();
  }

  async load() {
    const raw = await readFile(this.filePath, "utf8");
    return JSON.parse(raw);
  }

  async save(data) {
    const tempPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    this._writeQueue = this._writeQueue.then(() =>
      writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8").then(() =>
        rename(tempPath, this.filePath)
      )
    );
    return this._writeQueue;
  }
}
