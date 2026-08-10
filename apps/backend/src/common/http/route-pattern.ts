import { PATH_METADATA } from '@nestjs/common/constants';
import type { ExecutionContext } from '@nestjs/common';

/**
 * The route PATTERN for a request — `/fleet/trucks/:id`, never
 * `/fleet/trucks/9f3c…`.
 *
 * This distinction is the whole design of the metrics labels. A Prometheus
 * label built from `req.originalUrl` mints a new time series per truck id, per
 * booking id, per page cursor; a few thousand requests later the registry is
 * larger than the data it describes and the scrape times out. Express's
 * `req.route.path` is no good either — it holds only the handler's own suffix
 * (`:id`), so every controller's `:id` route collapses into one label.
 *
 * Nest's own metadata has both halves and neither problem.
 */
export function routePattern(context: ExecutionContext): string {
  const controller = pathOf(context.getClass());
  const handler = pathOf(context.getHandler());

  const joined = `/${controller}/${handler}`.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return joined === '' ? '/' : joined;
}

function pathOf(target: object): string {
  const value: unknown = Reflect.getMetadata(PATH_METADATA, target);

  // A controller declared with no path, or a handler on `/`, yields '' or '/'.
  if (typeof value === 'string') return value === '/' ? '' : value;
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0] === '/' ? '' : value[0];
  }
  return '';
}
