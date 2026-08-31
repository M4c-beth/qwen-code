/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Skills feature implementation
 *
 * This module provides the foundation for the skills feature, which allows
 * users to define reusable skill configurations that can be loaded by the
 * model via a dedicated Skills tool.
 *
 * Skills are stored as directories containing a SKILL.md file with YAML
 * frontmatter for metadata. They can be loaded from four levels
 * (precedence: project > user > extension > bundled):
 * - Project-level: `.qwen/skills/`
 * - User-level: `~/.qwen/skills/`
 * - Extension-level: provided by installed extensions
 * - Bundled: built-in skills shipped with qwen-code
 */

// Core types and interfaces
export type {
  SkillConfig,
  SkillLevel,
  SkillValidationResult,
  ListSkillsOptions,
  SkillErrorCode,
  DisclosureLevel,
} from './types.js';

export {
  SkillError,
  validateSkillName,
  METADATA,
  INSTRUCTIONS,
  RESOURCES,
} from './types.js';

// Main management class
export { SkillManager } from './skill-manager.js';

// Priority normalization, shared with the `/skills` display sort
export { normalizeSkillPriority } from './skill-load.js';

// Path-based conditional skill activation
export {
  SkillActivationRegistry,
  splitConditionalSkills,
} from './skill-activation.js';

// Progressive disclosure - skill catalog and formatting
export {
  buildCatalog,
  buildSkillBlock,
  formatCatalogEntry,
  formatLoadedSkill,
  getDisclosureLevel,
  hasInstructions,
  isMetadataOnly,
  splitSkillsByDisclosure,
} from './skill-catalog.js';

export type { SkillCatalogEntry, SkillGroups } from './skill-catalog.js';

// Progressive disclosure - skill loader tool
export {
  buildCatalogMap,
  createSkillLoaderTool,
  LOAD_SKILL_TOOL_NAME,
  SkillLoaderTool,
} from './skill-loader-tool.js';

export type {
  LoadSkillParams,
  SkillLoaderOptions,
} from './skill-loader-tool.js';

// Progressive disclosure integration
export {
  applyProgressiveDisclosure,
  buildLazyLoadCatalog,
  DEFAULT_PROGRESSIVE_DISCLOSURE_CONFIG,
  estimateTokenSavings,
  parseLazyLoadField,
  renderProgressiveDisclosureSkillEntry,
  separateSkillsForRendering,
  shouldLazyLoadSkill,
} from './skill-progressive-disclosure.js';

export type { ProgressiveDisclosureConfig } from './skill-progressive-disclosure.js';

// Project auto-skill lifecycle maintenance
export * from './skill-curator.js';
