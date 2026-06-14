import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const cwd = process.cwd();
const lockPath = path.join(cwd, ".next", "dev", "lock");

function isLockBusyError(error) {
  return error && ["EBUSY", "EPERM", "EACCES"].includes(error.code);
}

function ensureSafeLockState() {
  if (!fs.existsSync(lockPath)) {
    return;
  }

  try {
    // If we can read it, no process currently holds the file lock.
    fs.readFileSync(lockPath, "utf8");
    fs.rmSync(lockPath, { force: true });
    console.log("Removed stale Next.js lock file.");
  } catch (error) {
    if (isLockBusyError(error)) {
      console.error("Next.js dev lock is currently in use by another running instance.");
      console.error("Stop the other dev server first, then rerun: npm run dev:safe");
      process.exit(1);
    }

    throw error;
  }
}

function runNextDev() {
  const nextCli = path.join(cwd, "node_modules", "next", "dist", "bin", "next");

  const child = spawn(process.execPath, [nextCli, "dev"], {
    stdio: "inherit",
    cwd,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error("Failed to start Next.js dev server:", error.message);
    process.exit(1);
  });
}

ensureSafeLockState();
runNextDev();
