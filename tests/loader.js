import { resolve as pathResolve } from 'path';
import { pathToFileURL } from 'url';
import { existsSync } from 'fs';

const ROOT = pathResolve(import.meta.dirname, '..');

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let resolved = pathResolve(ROOT, 'src', specifier.slice(2));
    // Auto-append .js if no extension
    if (!resolved.match(/\.\w+$/) && existsSync(resolved + '.js')) {
      resolved += '.js';
    }
    return nextResolve(pathToFileURL(resolved).href, context);
  }
  return nextResolve(specifier, context);
}
