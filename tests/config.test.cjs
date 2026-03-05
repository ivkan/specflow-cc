/**
 * tests/config.test.cjs — Tests for bin/lib/config.cjs
 *
 * Run: node tests/config.test.cjs
 */

'use strict';

const assert = require('assert').strict;
const { MODEL_PROFILES, loadConfig } = require('../bin/lib/config.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL: ' + name);
    console.log('    ' + e.message);
  }
}

console.log('config.test.cjs');
console.log('');

// --- MODEL_PROFILES tests ---

console.log('MODEL_PROFILES:');

test('has all 11 agent types', () => {
  const expected = [
    'spec-creator', 'spec-auditor', 'spec-splitter', 'discusser',
    'spec-executor', 'spec-executor-orchestrator', 'spec-executor-worker',
    'impl-reviewer', 'spec-reviser', 'researcher', 'codebase-scanner',
  ];
  for (const agent of expected) {
    assert.ok(MODEL_PROFILES[agent], 'Missing agent: ' + agent);
  }
  assert.equal(Object.keys(MODEL_PROFILES).length, 11);
});

test('each agent has all 4 profiles', () => {
  for (const [agent, profiles] of Object.entries(MODEL_PROFILES)) {
    assert.ok(profiles.max, agent + ' missing max');
    assert.ok(profiles.quality, agent + ' missing quality');
    assert.ok(profiles.balanced, agent + ' missing balanced');
    assert.ok(profiles.budget, agent + ' missing budget');
  }
});

test('spec-executor balanced resolves to sonnet', () => {
  assert.equal(MODEL_PROFILES['spec-executor'].balanced, 'sonnet');
});

test('spec-executor quality resolves to opus', () => {
  assert.equal(MODEL_PROFILES['spec-executor'].quality, 'opus');
});

test('spec-creator balanced resolves to opus', () => {
  assert.equal(MODEL_PROFILES['spec-creator'].balanced, 'opus');
});

test('impl-reviewer budget resolves to haiku', () => {
  assert.equal(MODEL_PROFILES['impl-reviewer'].budget, 'haiku');
});

// --- loadConfig tests ---

console.log('');
console.log('loadConfig:');

test('loads existing config.json', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-config-test-'));
  try {
    const sfDir = path.join(tmpDir, '.specflow');
    fs.mkdirSync(sfDir, { recursive: true });
    fs.writeFileSync(path.join(sfDir, 'config.json'), JSON.stringify({ model_profile: 'quality' }), 'utf8');
    const config = loadConfig(tmpDir);
    assert.equal(config.model_profile, 'quality');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('defaults to balanced when config missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-config-test-'));
  try {
    const config = loadConfig(tmpDir);
    assert.equal(config.model_profile, 'balanced');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('defaults to balanced when config has invalid JSON', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-config-test-'));
  try {
    const sfDir = path.join(tmpDir, '.specflow');
    fs.mkdirSync(sfDir, { recursive: true });
    fs.writeFileSync(path.join(sfDir, 'config.json'), 'not json', 'utf8');
    const config = loadConfig(tmpDir);
    assert.equal(config.model_profile, 'balanced');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('defaults to balanced when model_profile field missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-config-test-'));
  try {
    const sfDir = path.join(tmpDir, '.specflow');
    fs.mkdirSync(sfDir, { recursive: true });
    fs.writeFileSync(path.join(sfDir, 'config.json'), JSON.stringify({ other: 'field' }), 'utf8');
    const config = loadConfig(tmpDir);
    assert.equal(config.model_profile, 'balanced');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- Summary ---

console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');

if (failed > 0) {
  process.exit(1);
}
