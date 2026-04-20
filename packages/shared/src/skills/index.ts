/**
 * Skills Module
 *
 * Workspace skills are specialized instructions that extend Claude's capabilities.
 */

export * from './types.ts';
export {
  AGENT_FOLDER_NAMES,
  GLOBAL_AGENT_SKILLS_DIR,
  GLOBAL_AGENT_SKILLS_DIRS,
  PROJECT_AGENT_SKILLS_DIR,
  PROJECT_AGENT_SKILLS_DIRS,
  loadSkill,
  loadAllSkills,
  invalidateSkillsCache,
  loadSkillBySlug,
  getSkillIconPath,
  deleteSkill,
  skillExists,
  listSkillSlugs,
  skillNeedsIconDownload,
  downloadSkillIcon,
} from './storage.ts';
