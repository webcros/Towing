import { Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ApiException } from '../errors/api-exception';

const SOURCE_LABEL: Record<ArgumentMetadata['type'], string> = {
  body: 'request body',
  query: 'query parameters',
  param: 'path parameters',
  custom: 'request',
};

/**
 * Zod replaces class-validator here: the same schemas are the shared client
 * contract in '@towing/api-contracts', so validating with them guarantees the
 * server and the apps disagree at compile time rather than in production.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    // Returning parsed data (not `value`) is the point: coercions, defaults and
    // transforms declared in the contract reach the handler already applied.
    if (result.success) return result.data;

    // A raw ZodError would surface as a 500; convert at the boundary so the
    // client always gets the 422 envelope with field-level details (spec §16).
    throw ApiException.validation(`Validation failed for ${SOURCE_LABEL[metadata.type]}`, {
      issues: result.error.issues.map((issue) => ({
        // Paths can hold symbols for record keys, which JSON would drop.
        path: issue.path.map((segment) => String(segment)).join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }
}
