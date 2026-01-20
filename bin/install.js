#!/usr/bin/env node

/**
 * SpecFlow installer
 * Copies commands, agents, and templates to ~/.claude/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SPECFLOW_DIR = path.join(CLAUDE_DIR, 'specflow');

const DIRS_TO_COPY = ['commands', 'agents', 'templates', 'hooks'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    ensureDir(dest);
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function install() {
  console.log('Installing SpecFlow...\n');

  const packageDir = path.dirname(__dirname);

  // Ensure .claude directory exists
  ensureDir(CLAUDE_DIR);
  ensureDir(SPECFLOW_DIR);

  // Copy each directory
  for (const dir of DIRS_TO_COPY) {
    const src = path.join(packageDir, dir);
    const dest = path.join(SPECFLOW_DIR, dir);

    if (fs.existsSync(src)) {
      console.log(`  Copying ${dir}/...`);
      copyRecursive(src, dest);
    }
  }

  // Create symlinks in .claude for commands
  const commandsSrc = path.join(SPECFLOW_DIR, 'commands');
  const commandsDest = path.join(CLAUDE_DIR, 'commands');

  if (fs.existsSync(commandsSrc)) {
    ensureDir(commandsDest);

    // Copy sf commands to .claude/commands/
    const sfSrc = path.join(commandsSrc, 'sf');
    const sfDest = path.join(commandsDest, 'sf');

    if (fs.existsSync(sfSrc)) {
      if (fs.existsSync(sfDest)) {
        fs.rmSync(sfDest, { recursive: true });
      }
      copyRecursive(sfSrc, sfDest);
    }
  }

  console.log('\n✅ SpecFlow installed successfully!');
  console.log('\nUsage:');
  console.log('  /sf init     - Initialize project');
  console.log('  /sf new      - Create specification');
  console.log('  /sf help     - Show all commands');
  console.log('\nDocumentation: https://github.com/ivkan/specflow-cc');
}

// Run installer
try {
  install();
} catch (error) {
  console.error('❌ Installation failed:', error.message);
  process.exit(1);
}
