export type CliDomainNamespace = 'label' | 'source' | 'skill' | 'automation' | 'permission' | 'theme'

export interface CliDomainPolicy {
  namespace: CliDomainNamespace
  helpCommand: string
  workspacePathScopes: string[]
  readActions: string[]
  quickExamples: string[]
  /** Optional workspace-relative paths guarded for direct Bash operations */
  bashGuardPaths?: string[]
}

const POLICIES: Record<CliDomainNamespace, CliDomainPolicy> = {
  label: {
    namespace: 'label',
    helpCommand: 'crabpal label --help',
    workspacePathScopes: ['labels/**'],
    readActions: ['list', 'get', 'auto-rule-list', 'auto-rule-validate'],
    quickExamples: [
      'crabpal label list',
      'crabpal label create --name "Bug" --color "accent"',
      'crabpal label update bug --json \'{"name":"Bug Report"}\'',
    ],
    bashGuardPaths: ['labels/**'],
  },
  source: {
    namespace: 'source',
    helpCommand: 'crabpal source --help',
    workspacePathScopes: ['sources/**'],
    readActions: ['list', 'get', 'validate', 'test', 'auth-help'],
    quickExamples: [
      'crabpal source list',
      'crabpal source get <slug>',
      'crabpal source update <slug> --json "{...}"',
      'crabpal source validate <slug>',
    ],
  },
  skill: {
    namespace: 'skill',
    helpCommand: 'crabpal skill --help',
    workspacePathScopes: ['skills/**'],
    readActions: ['list', 'get', 'validate', 'where'],
    quickExamples: [
      'crabpal skill list',
      'crabpal skill get <slug>',
      'crabpal skill update <slug> --json "{...}"',
      'crabpal skill validate <slug>',
    ],
  },
  automation: {
    namespace: 'automation',
    helpCommand: 'crabpal automation --help',
    workspacePathScopes: ['automations.json', 'automations-history.jsonl'],
    readActions: ['list', 'get', 'validate', 'history', 'last-executed', 'test', 'lint'],
    quickExamples: [
      'crabpal automation list',
      'crabpal automation create --event UserPromptSubmit --prompt "Summarize this prompt"',
      'crabpal automation update <id> --json "{\"enabled\":false}"',
      'crabpal automation history <id> --limit 20',
      'crabpal automation validate',
    ],
    bashGuardPaths: ['automations.json', 'automations-history.jsonl'],
  },
  permission: {
    namespace: 'permission',
    helpCommand: 'crabpal permission --help',
    workspacePathScopes: ['permissions.json', 'sources/*/permissions.json'],
    readActions: ['list', 'get', 'validate'],
    quickExamples: [
      'crabpal permission list',
      'crabpal permission get --source linear',
      'crabpal permission add-mcp-pattern "list" --comment "All list ops" --source linear',
      'crabpal permission validate',
    ],
    bashGuardPaths: ['permissions.json', 'sources/*/permissions.json'],
  },
  theme: {
    namespace: 'theme',
    helpCommand: 'crabpal theme --help',
    workspacePathScopes: ['config.json', 'theme.json', 'themes/*.json'],
    readActions: ['get', 'validate', 'list-presets', 'get-preset'],
    quickExamples: [
      'crabpal theme get',
      'crabpal theme list-presets',
      'crabpal theme set-color-theme nord',
      'crabpal theme set-workspace-color-theme default',
      'crabpal theme set-override --json "{\"accent\":\"#3b82f6\"}"',
    ],
    bashGuardPaths: ['config.json', 'theme.json', 'themes/*.json'],
  },
}

export const CLI_DOMAIN_POLICIES = POLICIES

export interface CliDomainScopeEntry {
  namespace: CliDomainNamespace
  scope: string
}

function dedupeScopes(scopes: string[]): string[] {
  return [...new Set(scopes)]
}

/**
 * Canonical workspace-relative path scopes owned by crabpal CLI domains.
 * Use these for file-path ownership checks to avoid drift across call sites.
 */
export const CRAFT_AGENTS_CLI_OWNED_WORKSPACE_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.workspacePathScopes)
)

/**
 * Canonical workspace-relative path scopes guarded for direct Bash operations.
 */
export const CRAFT_AGENTS_CLI_OWNED_BASH_GUARD_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.bashGuardPaths ?? [])
)

/**
 * Namespace-aware workspace scope entries for crabpal CLI owned paths.
 */
export const CRAFT_AGENTS_CLI_WORKSPACE_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => policy.workspacePathScopes.map(scope => ({ namespace: policy.namespace, scope })))

/**
 * Namespace-aware Bash guard scope entries.
 */
export const CRAFT_AGENTS_CLI_BASH_GUARD_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => (policy.bashGuardPaths ?? []).map(scope => ({ namespace: policy.namespace, scope })))

export interface BashPatternRule {
  pattern: string
  comment: string
}

/**
 * Derive the canonical Explore-mode read-only crabpal bash patterns from
 * CLI domain policies. Keeps permissions regexes aligned with command metadata.
 */
export function getCraftAgentReadOnlyBashPatterns(): BashPatternRule[] {
  const namespaces = Object.keys(POLICIES) as CliDomainNamespace[]
  const namespaceAlternation = namespaces.join('|')

  const rules: BashPatternRule[] = namespaces.map((namespace) => {
    const policy = POLICIES[namespace]
    const actions = policy.readActions.join('|')
    return {
      pattern: `^crabpal\\s+${namespace}\\s+(${actions})\\b`,
      comment: `crabpal ${namespace} read-only operations`,
    }
  })

  rules.push(
    { pattern: '^crabpal\\s*$', comment: 'crabpal bare invocation (prints help)' },
    { pattern: `^crabpal\\s+(${namespaceAlternation})\\s*$`, comment: 'crabpal entity help' },
    { pattern: `^crabpal\\s+(${namespaceAlternation})\\s+--help\\b`, comment: 'crabpal entity help flags' },
    { pattern: '^crabpal\\s+--(help|version|discover)\\b', comment: 'crabpal global flags' },
  )

  return rules
}

export function getCliDomainPolicy(namespace: CliDomainNamespace): CliDomainPolicy {
  return POLICIES[namespace]
}
