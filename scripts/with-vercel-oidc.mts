import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

function parseEnvValue(contents: string, name: string): string | undefined {
  const match = contents.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) return undefined;

  const raw = match[1].trim();
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

function resolveCommand(command: string): string {
  const localBinary = resolve(process.cwd(), "node_modules", ".bin", basename(command));
  return existsSync(localBinary) ? localBinary : command;
}

type PulledEnvironment = {
  oidcToken?: string;
};

function pullVercelEnvironment(): PulledEnvironment {
  const directory = mkdtempSync(join(tmpdir(), "sidequest-vercel-"));
  const destination = join(directory, "environment.local");

  try {
    const result = spawnSync(
      "vercel",
      ["env", "pull", destination, "--yes", "--environment=development"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "ignore", "pipe"],
      },
    );

    if (result.status !== 0) {
      const detail = result.stderr?.trim().split("\n").at(-1);
      throw new Error(detail || "Vercel could not refresh the project token.");
    }

    const contents = readFileSync(destination, "utf8");
    const oidcToken = parseEnvValue(contents, "VERCEL_OIDC_TOKEN");
    if (!oidcToken && !process.env.AI_GATEWAY_API_KEY) {
      throw new Error("Vercel returned no OIDC token for the linked Sidequest project.");
    }

    return { oidcToken };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const [requestedCommand, ...args] = process.argv.slice(2);
if (!requestedCommand) {
  throw new Error("Provide the command to run after refreshing Vercel authentication.");
}

const needsPulledEnvironment =
  !process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY;
const pulledEnvironment = needsPulledEnvironment ? pullVercelEnvironment() : {};
const oidcToken = process.env.VERCEL_OIDC_TOKEN ?? pulledEnvironment.oidcToken;

const childEnvironment = { ...process.env };
if (oidcToken) childEnvironment.VERCEL_OIDC_TOKEN = oidcToken;

const child = spawn(resolveCommand(requestedCommand), args, {
  cwd: process.cwd(),
  env: childEnvironment,
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(`Could not start ${requestedCommand}: ${error.message}`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
