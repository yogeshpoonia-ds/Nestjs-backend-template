import {
  PERMISSION_BY_KEY,
  PERMISSION_DEFINITIONS,
  type PermissionKey,
} from './permissions.js';

export type PermissionDependencyMap = ReadonlyMap<
  string,
  readonly string[]
>;

export function buildDependencyMap(
  definitions = PERMISSION_DEFINITIONS,
): Map<string, string[]> {
  return new Map(
    definitions.map((definition) => [
      definition.key,
      [...definition.dependsOn],
    ]),
  );
}

export function validatePermissionGraph(
  definitions = PERMISSION_DEFINITIONS,
): void {
  const known = new Set(definitions.map((definition) => definition.key));
  const adjacency = buildDependencyMap(definitions);

  for (const definition of definitions) {
    for (const dependency of definition.dependsOn) {
      if (dependency === definition.key) {
        throw new Error(
          `Permission "${definition.key}" cannot depend on itself`,
        );
      }

      if (!known.has(dependency)) {
        throw new Error(
          `Permission "${definition.key}" depends on unknown permission "${dependency}"`,
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (key: string, path: string[]): void => {
    if (visited.has(key)) {
      return;
    }

    if (visiting.has(key)) {
      throw new Error(
        `Circular permission dependency detected: ${[...path, key].join(' -> ')}`,
      );
    }

    visiting.add(key);

    for (const dependency of adjacency.get(key) ?? []) {
      visit(dependency, [...path, key]);
    }

    visiting.delete(key);
    visited.add(key);
  };

  for (const key of adjacency.keys()) {
    visit(key, []);
  }
}

export function expandDependencies(
  permissions: Iterable<string>,
  dependencyMap: PermissionDependencyMap = buildDependencyMap(),
): Set<string> {
  const result = new Set<string>();
  const stack = [...permissions];

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === undefined || result.has(current)) {
      continue;
    }

    result.add(current);

    for (const dependency of dependencyMap.get(current) ?? []) {
      if (!result.has(dependency)) {
        stack.push(dependency);
      }
    }
  }

  return result;
}

export function getDirectDependencies(
  key: PermissionKey,
): readonly PermissionKey[] {
  return PERMISSION_BY_KEY.get(key)?.dependsOn ?? [];
}
