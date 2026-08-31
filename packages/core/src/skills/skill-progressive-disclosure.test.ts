/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  applyProgressiveDisclosure,
  buildLazyLoadCatalog,
  estimateTokenSavings,
  parseLazyLoadField,
  separateSkillsForRendering,
  shouldLazyLoadSkill,
  DEFAULT_PROGRESSIVE_DISCLOSURE_CONFIG,
  type ProgressiveDisclosureConfig,
} from './skill-progressive-disclosure.js';
import type { SkillConfig } from './types.js';
import { METADATA, INSTRUCTIONS } from './types.js';

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

describe('DEFAULT_PROGRESSIVE_DISCLOSURE_CONFIG', () => {
  it('is disabled by default', () => {
    expect(DEFAULT_PROGRESSIVE_DISCLOSURE_CONFIG.enabled).toBe(false);
  });

  it('defaults to INSTRUCTIONS level', () => {
    expect(DEFAULT_PROGRESSIVE_DISCLOSURE_CONFIG.defaultDisclosureLevel).toBe(
      INSTRUCTIONS,
    );
  });
});

describe('shouldLazyLoadSkill', () => {
  it('returns false when progressive disclosure is disabled', () => {
    const skill = makeSkill({});
    const config: ProgressiveDisclosureConfig = { enabled: false };
    expect(shouldLazyLoadSkill(skill, config)).toBe(false);
  });

  it('returns false for skills in alwaysLoadedSkills list', () => {
    const skill = makeSkill({ name: 'important' });
    const config: ProgressiveDisclosureConfig = {
      enabled: true,
      defaultDisclosureLevel: METADATA,
      alwaysLoadedSkills: ['important'],
    };
    expect(shouldLazyLoadSkill(skill, config)).toBe(false);
  });

  it('returns true when enabled and default level is METADATA', () => {
    const skill = makeSkill({});
    const config: ProgressiveDisclosureConfig = {
      enabled: true,
      defaultDisclosureLevel: METADATA,
    };
    expect(shouldLazyLoadSkill(skill, config)).toBe(true);
  });

  it('returns false when default level is INSTRUCTIONS', () => {
    const skill = makeSkill({});
    const config: ProgressiveDisclosureConfig = {
      enabled: true,
      defaultDisclosureLevel: INSTRUCTIONS,
    };
    expect(shouldLazyLoadSkill(skill, config)).toBe(false);
  });
});

describe('applyProgressiveDisclosure', () => {
  it('returns skills unchanged when disabled', () => {
    const skills = [makeSkill({ body: 'content' })];
    const config: ProgressiveDisclosureConfig = { enabled: false };
    const result = applyProgressiveDisclosure(skills, config);
    expect(result[0].body).toBe('content');
  });

  it('sets body to empty and level to METADATA for lazy-loaded skills', () => {
    const skills = [makeSkill({ body: 'full content' })];
    const config: ProgressiveDisclosureConfig = {
      enabled: true,
      defaultDisclosureLevel: METADATA,
    };
    const result = applyProgressiveDisclosure(skills, config);
    expect(result[0].body).toBe('');
    expect(result[0].disclosureLevel).toBe(METADATA);
  });

  it('preserves skills in alwaysLoadedSkills list', () => {
    const skills = [
      makeSkill({ name: 'keep', body: 'content' }),
      makeSkill({ name: 'lazy', body: 'other' }),
    ];
    const config: ProgressiveDisclosureConfig = {
      enabled: true,
      defaultDisclosureLevel: METADATA,
      alwaysLoadedSkills: ['keep'],
    };
    const result = applyProgressiveDisclosure(skills, config);
    expect(result[0].body).toBe('content');
    expect(result[1].body).toBe('');
  });
});

describe('separateSkillsForRendering', () => {
  it('separates loaded and catalog skills', () => {
    const skills = [
      makeSkill({ name: 'loaded', disclosureLevel: INSTRUCTIONS }),
      makeSkill({ name: 'catalog', disclosureLevel: METADATA }),
    ];
    const { loaded, catalogEntries } = separateSkillsForRendering(skills);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('loaded');
    expect(catalogEntries).toHaveLength(1);
    expect(catalogEntries[0].name).toBe('catalog');
  });
});

describe('buildLazyLoadCatalog', () => {
  it('builds catalog map from metadata-level skills', () => {
    const skills = [
      makeSkill({ name: 'a', disclosureLevel: METADATA }),
      makeSkill({ name: 'b', disclosureLevel: INSTRUCTIONS }),
    ];
    const catalog = buildLazyLoadCatalog(skills);
    expect(catalog.size).toBe(1);
    expect(catalog.has('a')).toBe(true);
  });
});

describe('estimateTokenSavings', () => {
  it('returns zero savings when disabled', () => {
    const skills = [makeSkill({ body: 'content' })];
    const config: ProgressiveDisclosureConfig = { enabled: false };
    const result = estimateTokenSavings(skills, config);
    expect(result.charactersSaved).toBe(0);
    expect(result.skillsFullyLoaded).toBe(1);
    expect(result.skillsLazyLoaded).toBe(0);
  });

  it('estimates savings for lazy-loaded skills', () => {
    const skills = [makeSkill({ body: 'x'.repeat(100) })];
    const config: ProgressiveDisclosureConfig = {
      enabled: true,
      defaultDisclosureLevel: METADATA,
    };
    const result = estimateTokenSavings(skills, config);
    expect(result.charactersSaved).toBeGreaterThan(100);
    expect(result.skillsLazyLoaded).toBe(1);
    expect(result.skillsFullyLoaded).toBe(0);
  });
});

describe('parseLazyLoadField', () => {
  it('returns undefined when field is not present', () => {
    expect(parseLazyLoadField({})).toBeUndefined();
  });

  it('returns true for boolean true', () => {
    expect(parseLazyLoadField({ lazy_load: true })).toBe(true);
  });

  it('returns true for string "true"', () => {
    expect(parseLazyLoadField({ lazy_load: 'true' })).toBe(true);
  });

  it('returns false for boolean false', () => {
    expect(parseLazyLoadField({ lazy_load: false })).toBe(false);
  });

  it('returns false for string "false"', () => {
    expect(parseLazyLoadField({ lazy_load: 'false' })).toBe(false);
  });

  it('returns undefined for invalid values', () => {
    expect(parseLazyLoadField({ lazy_load: 'yes' })).toBeUndefined();
    expect(parseLazyLoadField({ lazy_load: 1 })).toBeUndefined();
  });
});
