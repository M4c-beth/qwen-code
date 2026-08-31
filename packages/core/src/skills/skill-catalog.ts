/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Skill catalog and progressive disclosure formatting.
 *
 * Provides functions to build lightweight skill catalogs for prompt injection
 * and format skill content at different disclosure levels. This enables
 * token optimization by keeping the system prompt small (metadata only)
 * and loading full instructions on demand via the skill loader tool.
 */

import type { SkillConfig } from './types.js';
import { INSTRUCTIONS, RESOURCES } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const LOAD_SKILL_TOOL_NAME = 'load_skill';

/**
 * A catalog entry representing a skill at metadata-only disclosure level.
 */
export interface SkillCatalogEntry {
  name: string;
  description: string;
  whenToUse?: string;
  skill: SkillConfig;
  label: string;
}

/**
 * Result of splitting skills into loaded vs catalog-only groups.
 */
export interface SkillGroups {
  loaded: SkillConfig[];
  catalog: SkillCatalogEntry[];
}

/**
 * Split skills into loaded (full instructions) and catalog (metadata only) groups.
 */
export function splitSkillsByDisclosure(
  skills: readonly SkillConfig[],
): SkillGroups {
  const loaded: SkillConfig[] = [];
  const catalogSkills: SkillConfig[] = [];

  for (const skill of skills) {
    const level = skill.disclosureLevel ?? INSTRUCTIONS;
    if (level >= INSTRUCTIONS) {
      loaded.push(skill);
    } else {
      catalogSkills.push(skill);
    }
  }

  return {
    loaded,
    catalog: buildCatalog(catalogSkills),
  };
}

/**
 * Build a catalog from metadata-only skills with name disambiguation.
 */
export function buildCatalog(
  skills: readonly SkillConfig[],
): SkillCatalogEntry[] {
  const nameCounts = new Map<string, number>();
  for (const skill of skills) {
    nameCounts.set(skill.name, (nameCounts.get(skill.name) ?? 0) + 1);
  }

  const catalog: SkillCatalogEntry[] = [];
  const usedLabels = new Set<string>();

  for (const skill of skills) {
    const needsDisambiguation = (nameCounts.get(skill.name) ?? 0) > 1;
    let label = skill.name;

    if (needsDisambiguation) {
      const parentDir = skill.filePath.split(/[\\/]/).slice(-2, -1)[0];
      if (parentDir) {
        label = `${parentDir}/${skill.name}`;
      }
      let attempt = 2;
      const baseLabel = label;
      while (usedLabels.has(label)) {
        label = `${baseLabel}-${attempt}`;
        attempt++;
      }
    }

    usedLabels.add(label);
    catalog.push({
      name: skill.name,
      description: skill.description,
      whenToUse: skill.whenToUse,
      skill,
      label,
    });
  }

  return catalog;
}

/**
 * Format a catalog entry for prompt injection at METADATA level.
 */
export function formatCatalogEntry(entry: SkillCatalogEntry): string {
  const parts = [`<skill name="${entry.label}">`];
  parts.push(entry.description);
  if (entry.whenToUse) {
    parts.push(`When to use: ${entry.whenToUse}`);
  }
  parts.push('</skill>');
  return parts.join('\n');
}

/**
 * Format a fully loaded skill for prompt injection at INSTRUCTIONS level.
 */
export function formatLoadedSkill(skill: SkillConfig, label?: string): string {
  const name = label ?? skill.name;
  const parts: string[] = [`<skill name="${name}">`];
  parts.push(skill.description);
  parts.push('');
  parts.push(skill.body);

  if (
    (skill.disclosureLevel ?? INSTRUCTIONS) >= RESOURCES &&
    skill.resourceFiles
  ) {
    parts.push('');
    parts.push('### Available Resources');
    for (const [dirName, files] of Object.entries(skill.resourceFiles)) {
      if (files.length > 0) {
        parts.push(`- **${dirName}/**: ${files.join(', ')}`);
      }
    }
  }

  parts.push('</skill>');
  return parts.join('\n');
}

/**
 * Build the complete skill block for system prompt injection.
 */
export function buildSkillBlock(
  skills: readonly SkillConfig[],
  loaderToolName: string = LOAD_SKILL_TOOL_NAME,
): string {
  const { loaded, catalog } = splitSkillsByDisclosure(skills);
  const blocks: string[] = [];

  if (loaded.length > 0) {
    const loadedContent = loaded
      .map((skill) => formatLoadedSkill(skill))
      .join('\n\n');
    blocks.push(`<skills>\n${loadedContent}\n</skills>`);
  }

  if (catalog.length > 0) {
    const catalogContent = catalog
      .map((entry) => formatCatalogEntry(entry))
      .join('\n\n');

    blocks.push(
      `<available_skills>\n` +
        `These skills are not loaded. Most requests need none of them, ` +
        `so answer directly unless one clearly applies to this request. ` +
        `When one does, call \`${loaderToolName}\` with its exact name to load its ` +
        `full instructions, and do not follow a skill's instructions ` +
        `without loading it first.\n\n` +
        `${catalogContent}\n` +
        `</available_skills>`,
    );
  }

  return blocks.length > 0 ? '\n\n' + blocks.join('\n\n') : '';
}

/**
 * Check if a skill is at metadata level (needs loading before use).
 */
export function isMetadataOnly(skill: SkillConfig): boolean {
  return (skill.disclosureLevel ?? INSTRUCTIONS) < INSTRUCTIONS;
}

/**
 * Check if a skill has full instructions loaded.
 */
export function hasInstructions(skill: SkillConfig): boolean {
  return (skill.disclosureLevel ?? INSTRUCTIONS) >= INSTRUCTIONS;
}

/**
 * Get the effective disclosure level of a skill.
 */
export function getDisclosureLevel(skill: SkillConfig): number {
  return skill.disclosureLevel ?? INSTRUCTIONS;
}

/**
 * Catalog resource files in a skill directory (scripts, references, assets).
 * Returns null if no resource files are found.
 */
export async function catalogResourceFiles(
  skillDir: string,
): Promise<Record<'scripts' | 'references' | 'assets', string[]> | null> {
  const resourceDirs: Array<'scripts' | 'references' | 'assets'> = [
    'scripts',
    'references',
    'assets',
  ];
  const result: Record<'scripts' | 'references' | 'assets', string[]> = {
    scripts: [],
    references: [],
    assets: [],
  };
  let hasAnyFiles = false;

  for (const dirName of resourceDirs) {
    const dirPath = path.join(skillDir, dirName);
    try {
      const files = await scanDirectory(dirPath, dirPath);
      result[dirName] = files;
      if (files.length > 0) hasAnyFiles = true;
    } catch {
      /* Directory doesn't exist */
    }
  }

  return hasAnyFiles ? result : null;
}

async function scanDirectory(
  dirPath: string,
  basePath: string,
): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await scanDirectory(fullPath, basePath)));
      } else if (entry.isFile()) {
        files.push(path.relative(basePath, fullPath));
      }
    }
  } catch {
    /* Ignore */
  }
  return files.sort();
}
