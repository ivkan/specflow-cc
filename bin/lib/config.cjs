/**
 * bin/lib/config.cjs — Config reading and model resolution
 *
 * Exports: MODEL_PROFILES, loadConfig(), cmdResolveModel()
 */

'use strict';

const path = require('path');
const { output, error, safeReadFile } = require('./core.cjs');

/**
 * Hardcoded MODEL_PROFILES table.
 * MUST exactly match the profile table in commands/sf/run.md.
 */
const MODEL_PROFILES = {
  'spec-creator':               { max: 'opus', quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
  'spec-auditor':               { max: 'opus', quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
  'spec-splitter':              { max: 'opus', quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
  'discusser':                  { max: 'opus', quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
  'spec-executor':              { max: 'opus', quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
  'spec-executor-orchestrator': { max: 'opus', quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
  'spec-executor-worker':       { max: 'opus', quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
  'impl-reviewer':              { max: 'opus', quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'spec-reviser':               { max: 'opus', quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet' },
  'researcher':                 { max: 'opus', quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'codebase-scanner':           { max: 'opus', quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};

/**
 * Load .specflow/config.json. Returns defaults if not found.
 * @param {string} cwd - Working directory
 * @returns {Object} Config object
 */
function loadConfig(cwd) {
  const configPath = path.join(cwd, '.specflow', 'config.json');
  const content = safeReadFile(configPath);

  if (!content) {
    return { model_profile: 'balanced' };
  }

  try {
    const config = JSON.parse(content);
    return {
      model_profile: config.model_profile || 'balanced',
      ...config,
    };
  } catch (e) {
    return { model_profile: 'balanced' };
  }
}

/**
 * Resolve model for a given agent type based on current profile.
 * @param {string} cwd - Working directory
 * @param {string} agentType - Agent type (e.g., "spec-executor")
 * @param {boolean} raw - Output raw string
 */
function cmdResolveModel(cwd, agentType, raw) {
  if (!agentType) {
    error('Missing agent type. Usage: resolve-model <agent-type>');
  }

  const config = loadConfig(cwd);
  const profile = config.model_profile || 'balanced';

  const agentProfiles = MODEL_PROFILES[agentType];

  if (!agentProfiles) {
    error('Unknown agent type: ' + agentType + '. Known types: ' + Object.keys(MODEL_PROFILES).join(', '));
  }

  const model = agentProfiles[profile];

  if (!model) {
    error('Unknown profile: ' + profile + '. Known profiles: max, quality, balanced, budget');
  }

  output({
    agent: agentType,
    profile: profile,
    model: model,
  }, raw, model);
}

module.exports = {
  MODEL_PROFILES,
  loadConfig,
  cmdResolveModel,
};
