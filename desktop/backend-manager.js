const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

function spawnLogged(nodeBin, scriptPath, { env, cwd, logFile }) {
  const child = spawn(nodeBin, [scriptPath], { env, cwd });
  if (logFile) {
    const log = fs.createWriteStream(logFile, { flags: "a" });
    child.stdout.pipe(log);
    child.stderr.pipe(log);
  }
  return child;
}

// Lanza un script Node y espera a que termine (usado para las migraciones).
function runToCompletion(nodeBin, scriptPath, opts) {
  return new Promise((resolve, reject) => {
    const child = spawnLogged(nodeBin, scriptPath, opts);
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} terminó con código ${code} (señal ${signal ?? "ninguna"})`));
    });
  });
}

// Lanza un proceso que se queda vivo (el servidor backend) y devuelve el handle.
function startPersistent(nodeBin, scriptPath, opts) {
  return spawnLogged(nodeBin, scriptPath, opts);
}

function waitForHealth(port, { timeoutMs = 20000, intervalMs = 300 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retryOrFail();
      });
      req.on("error", retryOrFail);
    };
    const retryOrFail = () => {
      if (Date.now() > deadline) {
        reject(new Error("El backend no respondió a tiempo"));
        return;
      }
      setTimeout(attempt, intervalMs);
    };
    attempt();
  });
}

function stop(child) {
  if (child && child.exitCode === null && !child.killed) {
    child.kill("SIGTERM");
  }
}

module.exports = { runToCompletion, startPersistent, waitForHealth, stop };
