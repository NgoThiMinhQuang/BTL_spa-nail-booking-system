import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const server = spawn(process.execPath, ['--watch', 'src/server.js'], {
  cwd: backendDirectory,
  stdio: ['inherit', 'pipe', 'inherit'],
});

let opened = false;
let pending = '';
server.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  pending += chunk.toString();
  const lines = pending.split(/\r?\n/);
  pending = lines.pop();
  for (const line of lines) {
    const match = line.match(/NailHouse API: http:\/\/.*:(\d+)/);
    if (opened || !match) continue;
    opened = true;
    const url = `http://localhost:${match[1]}/staff/`;
    console.log(`Giao diện nhân viên: ${url}`);
    const command = process.platform === 'win32' ? 'powershell.exe'
      : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32'
      ? ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${url}'`]
      : [url];
    const browser = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    browser.on('error', () => console.error(`Hãy mở trình duyệt tại ${url}`));
    browser.on('exit', (code) => {
      if (code) console.error(`Hãy mở trình duyệt tại ${url}`);
    });
  }
});

server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.on('exit', (code) => { process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
