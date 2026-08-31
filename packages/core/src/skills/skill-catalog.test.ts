/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  buildCatalog,
  buildSkillBlock,
  formatCatalogEntry,
  formatLoadedSkill,
  getDisclosureLevel,
  hasInstructions,
  isMetadataOnly,
  splitSkillsByDisclosure,
  LOAD_SKILL_TOOL_NAME,
} from './skill-catalog.js';
import type { SkillConfig } from './types.js';
import { METADATA, INSTRUCTIONS, RESOURCES } from './types.js';

function makeSkill(overrides: Partial<SkillConfig>): SkillConfig {
  return {
    name: overrides.name ?? 'test-skill',
    description: overrides.description ?? 'Test description',
    body: overrides.body ?? 'Skill body content',
    level: overrides.level ?? 'project',
    filePath: overrides.filePath ?? '/proj/.qwen/skills/test/SKILL.md',
    ...overrides,
  };
}

describe('LOAD_SKILL_TOOL_NAME', () => {
  it('has expected value', () => {
    expect(LOAD_SKILL_TOOL_NAME).toBe('load_skill');
  });
});

describe('isMetadataOnly', () => {
  it('returns true for METADATA level', () => {
    const skill = makeSkill({ disclosureLevel: METADATA });
    expect(isMetadataOnly(skill)).toBe(true);
  });

  it('returns false for INSTRUCTIONS level', () => {
    const skill = makeSkill({ disclosureLevel: INSTRUCTIONS });
    expect(isMetadataOnly(skill)).toBe(false);
  });

  it('returns false when disclosureLevel is undefined (defaults to INSTRUCTIONS)', () => {
    const skill = makeSkill({});
    expect(isMetadataOnly(skill)).toBe(false);
  });
});

describe('hasInstructions', () => {
  it('returns false for METADATA level', () => {
    const skill = makeSkill({ disclosureLevel: METADATA });
    expect(hasInstructions(skill)).toBe(false);
  });

  it('returns true for INSTRUCTIONS level', () => {
    const skill = makeSkill({ disclosureLevel: INSTRUCTIONS });
    expect(hasInstructions(skill)).toBe(true);
  });

  it('returns true for RESOURCES level', () => {
    const skill = makeSkill({ disclosureLevel: RESOURCES });
    expect(hasInstructions(skill)).toBe(true);
  });
});

describe('getDisclosureLevel', () => {
  it('returns the disclosure level when set', () => {
    const skill = makeSkill({ disclosureLevel: METADATA });
    expect(getDisclosureLevel(skill)).toBe(METADATA);
  });

  it('returns INSTRUCTIONS when disclosureLevel is undefined', () => {
    const skill = makeSkill({});
    expect(getDisclosureLevel(skill)).toBe(INSTRUCTIONS);
  });
});

describe('splitSkillsByDisclosure', () => {
  it('separates skills by disclosure level', () => {
    const skills = [
      makeSkill({ name: 'meta', disclosureLevel: METADATA }),
      makeSkill({ name: 'full', disclosureLevel: INSTRUCTIONS }),
    ];
    const { loaded, catalog } = splitSkillsByDisclosure(skills);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('full');
    expect(catalog).toHaveLength(1);
    expect(catalog[0].name).toBe('meta');
  });

  it('treats undefined disclosureLevel as INSTRUCTIONS', () => {
    const skills = [makeSkill({ name: 'default' })];
    const { loaded, catalog } = splitSkillsByDisclosure(skills);
    expect(loaded).toHaveLength(1);
    expect(catalog).toHaveLength(0);
  });
});

describe('buildCatalog', () => {
  it('creates catalog entries with labels', () => {
    const skills = [makeSkill({ name: 'skill-a' })];
    const catalog = buildCatalog(skills);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].name).toBe('skill-a');
    expect(catalog[0].label).toBe('skill-a');
  });

  it('disambiguates duplicate skill names with suffix', () => {
    const skills = [
      makeSkill({
        name: 'deploy',
        filePath: '/proj/skills/alpha/deploy/SKILL.md',
      }),
      makeSkill({
        name: 'deploy',
        filePath: '/proj/skills/beta/deploy/SKILL.md',
      }),
    ];
    const catalog = buildCatalog(skills);
    // First gets parentDir/name format, second gets suffixed
    expect(catalog[0].label).toBe('deploy/deploy');
    expect(catalog[1].label).toBe('deploy/deploy-2');
  });
});

describe('formatCatalogEntry', () => {
  it('formats entry as XML', () => {
    const entry = {
      name: 'test',
      description: 'A test skill',
      whenToUse: 'When testing',
      skill: makeSkill({}),
      label: 'test',
    };
    const result = formatCatalogEntry(entry);
    expect(result).toContain('<skill name="test">');
    expect(result).toContain('A test skill');
    expect(result).toContain('When to use: When testing');
    expect(result).toContain('</skill>');
  });
});

describe('formatLoadedSkill', () => {
  it('formats skill with body', () => {
    const skill = makeSkill({
      description: 'My skill',
      body: 'Do the thing',
    });
    const result = formatLoadedSkill(skill);
    expect(result).toContain('<skill name="test-skill">');
    expect(result).toContain('My skill');
    expect(result).toContain('Do the thing');
    expect(result).toContain('</skill>');
  });

  it('includes resource files when at RESOURCES level', () => {
    const skill = makeSkill({
      disclosureLevel: RESOURCES,
      resourceFiles: {
        scripts: ['run.sh'],
        references: [],
        assets: ['logo.png'],
      },
    });
    const result = formatLoadedSkill(skill);
    expect(result).toContain('### Available Resources');
    expect(result).toContain('scripts');
    expect(result).toContain('run.sh');
    expect(result).toContain('assets');
    expect(result).toContain('logo.png');
  });

  it('uses custom label when provided', () => {
    const skill = makeSkill({});
    const result = formatLoadedSkill(skill, 'custom-label');
    expect(result).toContain('<skill name="custom-label">');
  });
});

describe('buildSkillBlock', () => {
  it('returns empty string when no skills', () => {
    expect(buildSkillBlock([])).toBe('');
  });

  it('builds block with loaded skills only', () => {
    const skills = [makeSkill({ disclosureLevel: INSTRUCTIONS })];
    const result = buildSkillBlock(skills);
    expect(result).toContain('<skills>');
    expect(result).not.toContain('<available_skills>');
  });

  it('builds block with catalog only', () => {
    const skills = [makeSkill({ disclosureLevel: METADATA })];
    const result = buildSkillBlock(skills);
    expect(result).not.toContain('<skills>');
    expect(result).toContain('<available_skills>');
    expect(result).toContain(LOAD_SKILL_TOOL_NAME);
  });

  it('builds block with both loaded and catalog skills', () => {
    const skills = [
      makeSkill({ name: 'loaded', disclosureLevel: INSTRUCTIONS }),
      makeSkill({ name: 'catalog', disclosureLevel: METADATA }),
    ];
    const result = buildSkillBlock(skills);
    expect(result).toContain('<skills>');
    expect(result).toContain('<available_skills>');
  });

  it('uses custom loader tool name', () => {
    const skills = [makeSkill({ disclosureLevel: METADATA })];
    const result = buildSkillBlock(skills, 'custom_load');
    expect(result).toContain('custom_load');
  });
});
