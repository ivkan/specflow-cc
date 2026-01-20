#!/usr/bin/env node
// Claude Code Statusline - SpecFlow Edition
// Shows: model | spec status | directory | context usage

const fs = require('fs');
const path = require('path');

// Read JSON from stdin (Claude Code protocol)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const remaining = data.context_window?.remaining_percentage;

    // Context window display (shows USED percentage)
    let ctx = '';
    if (remaining != null) {
      const rem = Math.round(remaining);
      const used = Math.max(0, Math.min(100, 100 - rem));

      // Build progress bar (10 segments)
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      // Color based on usage
      if (used < 50) {
        ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 65) {
        ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 80) {
        ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = ` \x1b[5;31m💀 ${bar} ${used}%\x1b[0m`;
      }
    }

    // SpecFlow status from STATE.md
    let sfStatus = '';
    const stateFile = path.join(dir, '.specflow', 'STATE.md');
    if (fs.existsSync(stateFile)) {
      try {
        const content = fs.readFileSync(stateFile, 'utf8');
        const specMatch = content.match(/\*\*Active Specification:\*\*\s*(\S+)/);
        const statusMatch = content.match(/\*\*Status:\*\*\s*(\S+)/);

        const spec = specMatch ? specMatch[1] : null;
        const status = statusMatch ? statusMatch[1] : null;

        if (spec && spec !== '—' && spec !== 'none') {
          sfStatus = `\x1b[36m[SF: ${spec}`;
          if (status) {
            sfStatus += ` ${status}`;
          }
          sfStatus += ']\x1b[0m │ ';
        }
      } catch (e) {}
    }

    // Output
    const dirname = path.basename(dir);
    process.stdout.write(`${sfStatus}\x1b[2m${model}\x1b[0m │ \x1b[2m${dirname}\x1b[0m${ctx}`);
  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
});
