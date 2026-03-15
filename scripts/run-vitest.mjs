import { startVitest } from "vitest/node";

const watch = process.argv.includes("--watch");

await startVitest(
  "test",
  [],
  {
    watch,
    run: !watch,
    environment: "node",
    include: ["src/**/*.test.ts"],
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false
  },
  {
    configFile: false
  }
);
