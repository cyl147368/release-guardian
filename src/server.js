import { createRuntime } from "./bootstrap.js";

const runtime = createRuntime();
await runtime.listen();
