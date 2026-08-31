/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Integration layer for progressive disclosure in qwen-code.
 *
 * Bridges the progressive disclosure system with existing skill infrastructure.
 * When enabled, skills start at METADATA level and are loaded on demand.
 */

import type { SkillConfig } from './types.js';
import { INSTRUCTIONS, METADATA } from './types.js';
import type { SkillCatalogEntry } from './skill-catalog.js';
import { splitSkillsByDisclosure } from './skill-catalog.js';
import type { AvailableSkillEntry } from '../tools/skill-utils.js';
import { escapeXml } from '../utils/xml.js';

export interface ProgressiveDisclosureConfig {
  enabled: boolean;
  defaultDisclosureLevel?: 1 | 2 | 3;
  alwaysLoadedSkills?: string[];
}

export const DEFAULT_PROGRESSIVE_DISCLOSURE_CONFIG: ProgressiveDisclosureConfig =
  {
    enabled: false,
    defaultDisclosureLevel: INSTRUCTIONS,
    alwaysLoadedSkills: [],
  };

export function shouldLazyLoadSkill(
  skill: SkillConfig,
  config: ProgressiveDisclosureConfig,
): boolean {
  if (!config.enabled) return false;
  if (config.alwaysLoadedSkills?.includes(skill.name)) return false;
  const defaultLevel = config.defaultDisclosureLevel ?? INSTRUCTIONS;
  return defaultLevel === METADATA;
}

export function applyProgressiveDisclosure(
  skills: readonly SkillConfig[],
  config: ProgressiveDisclosureConfig,
): SkillConfig[] {
  if (!config.enabled) return [...skills];

  return skills.map((skill) => {
    if (shouldLazyLoadSkill(skill, config)) {
      return { ...skill, body: '', disclosureLevel: METADATA };
    }
    return skill;
  });
}

export function renderProgressiveDisclosureSkillEntry(
  entry: AvailableSkillEntry,
  isLazyLoaded: boolean,
): string {
  const descText = `${escapeXml(entry.description)}${
    entry.whenToUse ? ` — ${escapeXml(entry.whenToUse)}` : ''
  }${entry.level ? ` (${entry.level})` : ''}`;

  if (isLazyLoaded) {
    return `<skill>
<name>
${escapeXml(entry.name)}
</name>
<description>
${descText} [lazy-loaded: call load_skill to activate]
</description>
</skill>`;
  }

  return `<skill>
<name>
${escapeXml(entry.name)}
</name>
<description>
${descText}
</description>
</skill>`;
}

export function buildLazyLoadCatalog(
  skills: readonly SkillConfig[],
): Map<string, SkillCatalogEntry> {
  const { catalog } = splitSkillsByDisclosure(skills);
  const catalogMap = new Map<string, SkillCatalogEntry>();
  for (const entry of catalog) catalogMap.set(entry.label, entry);
  return catalogMap;
}

export function separateSkillsForRendering(skills: readonly SkillConfig[]): {
  loaded: SkillConfig[];
  catalogEntries: SkillCatalogEntry[];
} {
  const { loaded, catalog } = splitSkillsByDisclosure(skills);
  return { loaded, catalogEntries: catalog };
}

export function estimateTokenSavings(
  skills: readonly SkillConfig[],
  config: ProgressiveDisclosureConfig,
): {
  charactersSaved: number;
  skillsLazyLoaded: number;
  skillsFullyLoaded: number;
} {
  if (!config.enabled) {
    return {
      charactersSaved: 0,
      skillsLazyLoaded: 0,
      skillsFullyLoaded: skills.length,
    };
  }

  let charactersSaved = 0;
  let skillsLazyLoaded = 0;
  let skillsFullyLoaded = 0;

  for (const skill of skills) {
    if (shouldLazyLoadSkill(skill, config)) {
      charactersSaved += skill.body.length + 100;
      skillsLazyLoaded++;
    } else {
      skillsFullyLoaded++;
    }
  }

  return { charactersSaved, skillsLazyLoaded, skillsFullyLoaded };
}

export function parseLazyLoadField(
  frontmatter: Record<string, unknown>,
): boolean | undefined {
  const raw = frontmatter['lazy_load'];
  if (raw === undefined) return undefined;
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  return undefined;
}
