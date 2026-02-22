#!/usr/bin/env node
import { spawn } from 'node:child_process'

const child = spawn('pnpm', ['vitest', 'run', 'src/lib/perf-megafixture.test.ts'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  shell: process.platform === 'win32',
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})

