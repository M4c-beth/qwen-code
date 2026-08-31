/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Runtime skill loader tool for progressive disclosure.
 *
 * Provides a tool that the model can call to load a specific skill's full
 * instructions from the metadata-only catalog. This enables token optimization
 * by keeping the system prompt small and loading skills on demand.
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
} from '../tools/tools.js';
import type { ToolResult } from '../tools/tools.js';
import type { SkillConfig } from './types.js';
import { INSTRUCTIONS, RESOURCES } from './types.js';
import type { SkillCatalogEntry } from './skill-catalog.js';
import {
  formatLoadedSkill,
  catalogResourceFiles,
  LOAD_SKILL_TOOL_NAME,
} from './skill-catalog.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('SKILL_LOADER');

export { LOAD_SKILL_TOOL_NAME };

export interface LoadSkillParams {
  skill_name: string;
}

export type SkillLoaderFunction = (skill: SkillConfig) => Promise<SkillConfig>;

export interface SkillLoaderOptions {
  catalog: Map<string, SkillCatalogEntry>;
  loadedSkills?: Map<string, SkillConfig>;
  onSkillLoaded?: (skillName: string, skill: SkillConfig) => void;
  skillLoader?: SkillLoaderFunction;
}

class LoadSkillInvocation extends BaseToolInvocation<
  LoadSkillParams,
  ToolResult
> {
  constructor(
    params: LoadSkillParams,
    private readonly catalog: Map<string, SkillCatalogEntry>,
    private readonly loadedSkills: Map<string, SkillConfig>,
    private readonly onSkillLoaded?: (
      skillName: string,
      skill: SkillConfig,
    ) => void,
    private readonly skillLoader?: SkillLoaderFunction,
  ) {
    super(params);
  }

  getDescription(): string {
    return `Load skill: "${this.params.skill_name}"`;
  }

  async execute(): Promise<ToolResult> {
    const skillName = this.params.skill_name;

    const alreadyLoaded = this.loadedSkills.get(skillName);
    if (alreadyLoaded) {
      const content = formatLoadedSkill(alreadyLoaded, skillName);
      return {
        llmContent: content,
        returnDisplay: `Skill "${skillName}" already loaded`,
      };
    }

    const entry = this.catalog.get(skillName);
    if (!entry) {
      const available = Array.from(this.catalog.keys()).join(', ');
      const message =
        this.catalog.size > 0
          ? `Skill "${skillName}" not found. Available: ${available}`
          : `No skills available for loading.`;
      return { llmContent: message, returnDisplay: message };
    }

    try {
      const loader = this.skillLoader ?? loadFullSkillDefault;
      const loadedSkill = await loader(entry.skill);
      this.onSkillLoaded?.(skillName, loadedSkill);
      const content = formatLoadedSkill(loadedSkill, entry.label);
      debugLogger.info(
        `Loaded skill "${skillName}" at level ${loadedSkill.disclosureLevel}`,
      );
      return {
        llmContent: content,
        returnDisplay: `Loaded skill: ${skillName}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Failed to load "${skillName}": ${errorMessage}`,
        returnDisplay: errorMessage,
      };
    }
  }
}

async function loadFullSkillDefault(skill: SkillConfig): Promise<SkillConfig> {
  const skillDir = path.dirname(skill.filePath);
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const content = await fs.readFile(skillMdPath, 'utf8');

  const frontmatterRegex = /^---\n[\s\S]*?\n---(?:\n|$)([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  const body = match ? match[1].trim() : '';
  const resourceFiles = await catalogResourceFiles(skillDir);

  return {
    ...skill,
    body,
    disclosureLevel: resourceFiles ? RESOURCES : INSTRUCTIONS,
    resourceFiles: resourceFiles ?? undefined,
  };
}

export class SkillLoaderTool extends BaseDeclarativeTool<
  LoadSkillParams,
  ToolResult
> {
  static readonly Name = LOAD_SKILL_TOOL_NAME;
  private readonly catalog: Map<string, SkillCatalogEntry>;
  private readonly loadedSkills: Map<string, SkillConfig>;
  private readonly onSkillLoaded?: (
    skillName: string,
    skill: SkillConfig,
  ) => void;
  private readonly skillLoader?: SkillLoaderFunction;

  constructor(options: SkillLoaderOptions) {
    super(
      LOAD_SKILL_TOOL_NAME,
      'LoadSkill',
      LOAD_SKILL_TOOL_DESCRIPTION,
      Kind.Read,
      {
        type: 'object',
        properties: {
          skill_name: {
            type: 'string',
            description: 'Exact name of the skill to load.',
          },
        },
        required: ['skill_name'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#',
      },
      false,
      false,
    );
    this.catalog = options.catalog;
    this.loadedSkills = options.loadedSkills ?? new Map();
    this.onSkillLoaded = options.onSkillLoaded;
    this.skillLoader = options.skillLoader;
  }

  protected override validateToolParamValues(
    params: LoadSkillParams,
  ): string | null {
    if (!params.skill_name) return 'Parameter "skill_name" is required.';
    if (this.loadedSkills.has(params.skill_name)) return null;
    if (!this.catalog.has(params.skill_name)) {
      const available = Array.from(this.catalog.keys()).join(', ');
      return this.catalog.size > 0
        ? `Skill not found. Available: ${available}`
        : 'No skills available.';
    }
    return null;
  }

  protected createInvocation(params: LoadSkillParams): LoadSkillInvocation {
    return new LoadSkillInvocation(
      params,
      this.catalog,
      this.loadedSkills,
      this.onSkillLoaded,
      this.skillLoader,
    );
  }

  updateCatalog(newCatalog: Map<string, SkillCatalogEntry>): void {
    for (const [key, entry] of newCatalog) {
      if (!this.catalog.has(key)) this.catalog.set(key, entry);
    }
    for (const key of this.catalog.keys()) {
      if (!newCatalog.has(key) && !this.loadedSkills.has(key))
        this.catalog.delete(key);
    }
  }

  markAsLoaded(skillName: string, skill: SkillConfig): void {
    this.loadedSkills.set(skillName, skill);
  }

  clearLoadedSkills(): void {
    this.loadedSkills.clear();
  }

  getLoadedSkillNames(): ReadonlySet<string> {
    return new Set(this.loadedSkills.keys());
  }
}

const LOAD_SKILL_TOOL_DESCRIPTION = `Load one available skill's full instructions.

Most requests need no skill, so only call this when an available skill's description clearly matches the current request.

The skill catalog shows available skills at metadata level. Use this tool to load full instructions when a skill applies to the current task.`;

export function createSkillLoaderTool(
  catalog: Map<string, SkillCatalogEntry>,
  options?: {
    loadedSkills?: Map<string, SkillConfig>;
    onSkillLoaded?: (skillName: string, skill: SkillConfig) => void;
    skillLoader?: SkillLoaderFunction;
  },
): SkillLoaderTool | null {
  if (catalog.size === 0) return null;
  return new SkillLoaderTool({
    catalog,
    loadedSkills: options?.loadedSkills,
    onSkillLoaded: options?.onSkillLoaded,
    skillLoader: options?.skillLoader,
  });
}

export function buildCatalogMap(
  entries: SkillCatalogEntry[],
): Map<string, SkillCatalogEntry> {
  const map = new Map<string, SkillCatalogEntry>();
  for (const entry of entries) map.set(entry.label, entry);
  return map;
}
