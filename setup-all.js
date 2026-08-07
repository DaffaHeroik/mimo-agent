#!/usr/bin/env node
// Legacy wrapper → delegates to mimo-setup.js

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const child = spawn('node', [path.join(__dirname, 'mimo-setup.js'), ...args], {
  stdio: 'inherit',
  cwd: __dirname
});
child.on('close', code => process.exit(code));
