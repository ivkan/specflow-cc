#!/usr/bin/env node

/**
 * SpecFlow installer
 * Copies commands, agents, templates, and hooks to ~/.claude/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Get version from package.json
const pkg = require('../package.json');

const banner = `
${cyan}  ███████╗██████╗ ███████╗ ██████╗███████╗██╗      ██████╗ ██╗    ██╗
  ██╔════╝██╔══██╗██╔════╝██╔════╝██╔════╝██║     ██╔═══██╗██║    ██║
  ███████╗██████╔╝█████╗  ██║     █████╗  ██║     ██║   ██║██║ █╗ ██║
  ╚════██║██╔═══╝ ██╔══╝  ██║     ██╔══╝  ██║     ██║   ██║██║███╗██║
  ███████║██║     ███████╗╚██████╗██║     ███████╗╚██████╔╝╚███╔███╔╝
  ╚══════╝╚═╝     ╚══════╝ ╚═════╝╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝${reset}

  Spec-Driven Development ${dim}v${pkg.version}${reset}
  Quality-first workflow for Claude Code
`;

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasHelp = args.includes('--help') || args.includes('-h');
const forceStatusline = args.includes('--force-statusline');

console.log(banner);

// Show help if requested
if (hasHelp) {
  console.log(`  ${yellow}Usage:${reset} npx specflow-cc [options]

  ${yellow}Options:${reset}
    ${cyan}-g, --global${reset}           Install globally (to ~/.claude)
    ${cyan}-l, --local${reset}            Install locally (to ./.claude)
    ${cyan}--force-statusline${reset}     Replace existing statusline config
    ${cyan}-h, --help${reset}             Show this help message

  ${yellow}Examples:${reset}
    ${dim}# Install to default ~/.claude directory${reset}
    npx specflow-cc --global

    ${dim}# Install to current project only${reset}
    npx specflow-cc --local
`);
  process.exit(0);
}

/**
 * Read and parse settings.json
 */
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

/**
 * Write settings.json with proper formatting
 */
function writeSettings(settingsPath, settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * Recursively copy directory, replacing paths in .md files
 */
function copyWithPathReplacement(srcDir, destDir, pathPrefix) {
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithPathReplacement(srcPath, destPath, pathPrefix);
    } else if (entry.name.endsWith('.md')) {
      // Replace ~/.claude/specflow-cc/ with the appropriate prefix
      let content = fs.readFileSync(srcPath, 'utf8');
      content = content.replace(/~\/\.claude\/specflow-cc\//g, pathPrefix);
      fs.writeFileSync(destPath, content);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Verify a directory exists and contains files
 */
function verifyInstalled(dirPath, description) {
  if (!fs.existsSync(dirPath)) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}`);
    return false;
  }
  try {
    const entries = fs.readdirSync(dirPath);
    if (entries.length === 0) {
      console.error(`  ${yellow}✗${reset} Failed to install ${description}: empty`);
      return false;
    }
  } catch (e) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: ${e.message}`);
    return false;
  }
  return true;
}

/**
 * Install to the specified directory
 */
function install(isGlobal) {
  const src = path.join(__dirname, '..');
  const claudeDir = isGlobal
    ? path.join(os.homedir(), '.claude')
    : path.join(process.cwd(), '.claude');

  const specflowDir = path.join(claudeDir, 'specflow-cc');
  const locationLabel = isGlobal ? '~/.claude' : './.claude';

  // Path prefix for file references
  const pathPrefix = isGlobal ? '~/.claude/specflow-cc/' : './.claude/specflow-cc/';

  console.log(`  Installing to ${cyan}${locationLabel}${reset}\n`);

  const failures = [];

  // Ensure directories exist
  fs.mkdirSync(specflowDir, { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'commands'), { recursive: true });

  // Copy commands/sf
  const commandsSrc = path.join(src, 'commands', 'sf');
  const commandsDest = path.join(claudeDir, 'commands', 'sf');
  if (fs.existsSync(commandsSrc)) {
    copyWithPathReplacement(commandsSrc, commandsDest, pathPrefix);
    if (verifyInstalled(commandsDest, 'commands/sf')) {
      console.log(`  ${green}✓${reset} Installed commands/sf`);
    } else {
      failures.push('commands/sf');
    }
  }

  // Copy agents to specflow-cc/agents (and also to ~/.claude/agents for subagent discovery)
  const agentsSrc = path.join(src, 'agents');
  if (fs.existsSync(agentsSrc)) {
    // Copy to specflow-cc/agents
    const agentsDest = path.join(specflowDir, 'agents');
    copyWithPathReplacement(agentsSrc, agentsDest, pathPrefix);

    // Also copy to ~/.claude/agents for subagent_type discovery
    const globalAgentsDest = path.join(claudeDir, 'agents');
    fs.mkdirSync(globalAgentsDest, { recursive: true });

    // Remove old sf-* agents, then copy new ones
    if (fs.existsSync(globalAgentsDest)) {
      for (const file of fs.readdirSync(globalAgentsDest)) {
        if (file.startsWith('sf-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(globalAgentsDest, file));
        }
      }
    }

    for (const entry of fs.readdirSync(agentsSrc)) {
      if (entry.endsWith('.md')) {
        let content = fs.readFileSync(path.join(agentsSrc, entry), 'utf8');
        content = content.replace(/~\/\.claude\/specflow-cc\//g, pathPrefix);
        fs.writeFileSync(path.join(globalAgentsDest, `sf-${entry}`), content);
      }
    }

    if (verifyInstalled(agentsDest, 'agents')) {
      console.log(`  ${green}✓${reset} Installed agents`);
    } else {
      failures.push('agents');
    }
  }

  // Copy templates
  const templatesSrc = path.join(src, 'templates');
  if (fs.existsSync(templatesSrc)) {
    const templatesDest = path.join(specflowDir, 'templates');
    copyWithPathReplacement(templatesSrc, templatesDest, pathPrefix);
    if (verifyInstalled(templatesDest, 'templates')) {
      console.log(`  ${green}✓${reset} Installed templates`);
    } else {
      failures.push('templates');
    }
  }

  // Copy hooks
  const hooksSrc = path.join(src, 'hooks');
  if (fs.existsSync(hooksSrc)) {
    const hooksDest = path.join(claudeDir, 'hooks');
    fs.mkdirSync(hooksDest, { recursive: true });
    for (const entry of fs.readdirSync(hooksSrc)) {
      fs.copyFileSync(path.join(hooksSrc, entry), path.join(hooksDest, entry));
    }
    if (verifyInstalled(hooksDest, 'hooks')) {
      console.log(`  ${green}✓${reset} Installed hooks`);
    } else {
      failures.push('hooks');
    }
  }

  // Copy CHANGELOG.md
  const changelogSrc = path.join(src, 'CHANGELOG.md');
  if (fs.existsSync(changelogSrc)) {
    fs.copyFileSync(changelogSrc, path.join(specflowDir, 'CHANGELOG.md'));
    console.log(`  ${green}✓${reset} Installed CHANGELOG.md`);
  }

  // Write VERSION file
  fs.writeFileSync(path.join(specflowDir, 'VERSION'), pkg.version);
  console.log(`  ${green}✓${reset} Wrote VERSION (${pkg.version})`);

  if (failures.length > 0) {
    console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);
    process.exit(1);
  }

  // Configure statusline in settings.json
  const settingsPath = path.join(claudeDir, 'settings.json');
  const settings = readSettings(settingsPath);
  const statuslineCommand = isGlobal
    ? 'node "$HOME/.claude/hooks/statusline.js"'
    : 'node .claude/hooks/statusline.js';

  return { settingsPath, settings, statuslineCommand };
}

/**
 * Apply statusline config and print completion message
 */
function finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline) {
  if (shouldInstallStatusline) {
    settings.statusLine = {
      type: 'command',
      command: statuslineCommand
    };
    console.log(`  ${green}✓${reset} Configured statusline`);
  }

  writeSettings(settingsPath, settings);

  console.log(`
  ${green}Done!${reset} Launch Claude Code and run ${cyan}/sf:help${reset}.

  ${yellow}Quick start:${reset}
    /sf:init     - Initialize project
    /sf:new      - Create specification
    /sf:help     - Show all commands
`);
}

/**
 * Handle statusline configuration
 */
function handleStatusline(settings, isInteractive, callback) {
  const hasExisting = settings.statusLine != null;

  if (!hasExisting) {
    callback(true);
    return;
  }

  if (forceStatusline) {
    callback(true);
    return;
  }

  if (!isInteractive) {
    console.log(`  ${yellow}⚠${reset} Skipping statusline (already configured)`);
    console.log(`    Use ${cyan}--force-statusline${reset} to replace\n`);
    callback(false);
    return;
  }

  const existingCmd = settings.statusLine.command || settings.statusLine.url || '(custom)';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`
  ${yellow}⚠${reset} Existing statusline detected

  Your current statusline:
    ${dim}command: ${existingCmd}${reset}

  SpecFlow includes a statusline showing:
    • Model name
    • Current spec status [SF: SPEC-XXX status]
    • Context window usage (color-coded)

  ${cyan}1${reset}) Keep existing
  ${cyan}2${reset}) Replace with SpecFlow statusline
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    callback(choice === '2');
  });
}

/**
 * Prompt for install location
 */
function promptLocation() {
  if (!process.stdin.isTTY) {
    console.log(`  ${yellow}Non-interactive terminal, defaulting to global install${reset}\n`);
    const { settingsPath, settings, statuslineCommand } = install(true);
    handleStatusline(settings, false, (shouldInstallStatusline) => {
      finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline);
    });
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let answered = false;

  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Input closed, defaulting to global install${reset}\n`);
      const { settingsPath, settings, statuslineCommand } = install(true);
      handleStatusline(settings, false, (shouldInstallStatusline) => {
        finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline);
      });
    }
  });

  console.log(`  ${yellow}Where would you like to install?${reset}

  ${cyan}1${reset}) Global ${dim}(~/.claude)${reset} - available in all projects
  ${cyan}2${reset}) Local  ${dim}(./.claude)${reset} - this project only
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    const isGlobal = choice !== '2';
    const { settingsPath, settings, statuslineCommand } = install(isGlobal);
    handleStatusline(settings, true, (shouldInstallStatusline) => {
      finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline);
    });
  });
}

// Main
if (hasGlobal && hasLocal) {
  console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
  process.exit(1);
} else if (hasGlobal) {
  const { settingsPath, settings, statuslineCommand } = install(true);
  handleStatusline(settings, false, (shouldInstallStatusline) => {
    finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline);
  });
} else if (hasLocal) {
  const { settingsPath, settings, statuslineCommand } = install(false);
  handleStatusline(settings, false, (shouldInstallStatusline) => {
    finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline);
  });
} else {
  promptLocation();
}
