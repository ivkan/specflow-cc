/**
 * bin/lib/verify.cjs — Structure verification checks
 *
 * Exports: cmdVerifyStructure()
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { output, safeReadFile, parseFrontmatter } = require('./core.cjs');
const { extractActiveSpec } = require('./state.cjs');

/**
 * Verify .specflow/ directory structure and integrity.
 * Performs 6 read-only checks. Does NOT repair issues.
 *
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output raw string
 */
function cmdVerifyStructure(cwd, raw) {
  const checks = [];
  const errors = [];

  // Check 1: .specflow/ directory exists
  const specflowDir = path.join(cwd, '.specflow');
  const specflowExists = fs.existsSync(specflowDir) && fs.statSync(specflowDir).isDirectory();
  checks.push({ name: '.specflow/ directory exists', passed: specflowExists });
  if (!specflowExists) {
    errors.push('.specflow/ directory not found');
  }

  // Check 2: STATE.md exists and has "Active Specification" section
  const statePath = path.join(cwd, '.specflow', 'STATE.md');
  const stateContent = safeReadFile(statePath);
  const stateHasSection = stateContent ? stateContent.includes('## Active Specification') : false;
  const stateValid = !!stateContent && stateHasSection;
  checks.push({ name: 'STATE.md exists with Active Specification section', passed: stateValid });
  if (!stateContent) {
    errors.push('STATE.md not found');
  } else if (!stateHasSection) {
    errors.push('STATE.md missing "## Active Specification" section');
  }

  // Check 3: specs/ directory exists
  const specsDir = path.join(cwd, '.specflow', 'specs');
  const specsDirExists = fs.existsSync(specsDir) && fs.statSync(specsDir).isDirectory();
  checks.push({ name: '.specflow/specs/ directory exists', passed: specsDirExists });
  if (!specsDirExists) {
    errors.push('.specflow/specs/ directory not found');
  }

  // Check 4: archive/ directory exists
  const archiveDir = path.join(cwd, '.specflow', 'archive');
  const archiveDirExists = fs.existsSync(archiveDir) && fs.statSync(archiveDir).isDirectory();
  checks.push({ name: '.specflow/archive/ directory exists', passed: archiveDirExists });
  if (!archiveDirExists) {
    errors.push('.specflow/archive/ directory not found');
  }

  // Check 5: Active spec referenced in STATE.md exists in specs/ (if set)
  let activeSpecCheck = true;
  if (stateContent) {
    const activeSpec = extractActiveSpec(stateContent);

    if (activeSpec && activeSpec !== 'None' && activeSpec !== '(none)') {
      const activeSpecPath = path.join(specsDir, activeSpec + '.md');
      const activeSpecExists = fs.existsSync(activeSpecPath);
      activeSpecCheck = activeSpecExists;
      if (!activeSpecExists) {
        errors.push('Active spec ' + activeSpec + ' not found in specs/');
      }
    }
  }
  checks.push({ name: 'Active spec exists in specs/ (if set)', passed: activeSpecCheck });

  // Check 6: All specs in specs/ have valid YAML frontmatter with required fields
  let allSpecsValid = true;
  if (specsDirExists) {
    let specFiles;
    try {
      specFiles = fs.readdirSync(specsDir).filter(f => f.endsWith('.md'));
    } catch (e) {
      specFiles = [];
    }

    for (const file of specFiles) {
      const content = safeReadFile(path.join(specsDir, file));
      if (!content) {
        allSpecsValid = false;
        errors.push('Cannot read spec file: ' + file);
        continue;
      }

      const parsed = parseFrontmatter(content);
      const fm = parsed.frontmatter;
      const requiredFields = ['id', 'type', 'status'];
      const missingFields = requiredFields.filter(f => !fm[f]);

      if (missingFields.length > 0) {
        allSpecsValid = false;
        errors.push(file + ' missing required frontmatter fields: ' + missingFields.join(', '));
      }
    }
  } else {
    allSpecsValid = false;
  }
  checks.push({ name: 'All specs have valid frontmatter (id, type, status)', passed: allSpecsValid });

  const valid = checks.every(c => c.passed);

  output({ valid, checks, errors }, raw, valid ? 'valid' : 'invalid');
}

module.exports = {
  cmdVerifyStructure,
};
