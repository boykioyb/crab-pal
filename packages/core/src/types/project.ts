/**
 * Project types
 *
 * A Project groups sessions inside a workspace and is backed by a folder on disk.
 * Hierarchy: Workspace → Projects → Sessions.
 *
 * Each session belongs to exactly one project. A session's working directory
 * defaults to its project's rootPath, but can be overridden per-session via
 * {@link Session.workingDirectory}.
 */

/**
 * Project — groups sessions inside a workspace, backed by a folder.
 */
export interface Project {
  /** Unique identifier (stable). */
  id: string;
  /** Parent workspace ID. */
  workspaceId: string;
  /** Display name. */
  name: string;
  /** URL-safe slug derived from name (used for sorting / folder-style refs). */
  slug: string;
  /** Absolute path to the folder this project is backed by. Required. */
  rootPath: string;
  /** Optional user-chosen color tag (e.g. a hex string or theme key). */
  color?: string;
  /** ISO string — when the project was created. */
  createdAt: string;
  /** ISO string — last time the project was accessed. */
  lastUsedAt: string;
}

/**
 * Input used to create a new project. The server fills in id/slug/timestamps.
 */
export interface CreateProjectInput {
  /** Parent workspace ID. */
  workspaceId: string;
  /** Display name. */
  name: string;
  /** Absolute folder path this project is backed by. Required. */
  rootPath: string;
  /** Optional color tag. */
  color?: string;
}

/**
 * Patch for updating an existing project. All fields optional.
 * id/workspaceId/createdAt are not mutable via updates.
 */
export interface UpdateProjectPatch {
  name?: string;
  rootPath?: string;
  color?: string;
  /** Bump lastUsedAt to a specific ISO timestamp. */
  lastUsedAt?: string;
}
