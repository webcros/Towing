import { Body, Param, Query } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * Thin wrappers so a handler names its contract once. Without them every route
 * repeats `@Body(new ZodValidationPipe(schema))`, and the pipe is easy to omit
 * — which silently makes the endpoint unvalidated.
 */
export const ZodBody = (schema: ZodType): ParameterDecorator => Body(new ZodValidationPipe(schema));

export const ZodQuery = (schema: ZodType): ParameterDecorator =>
  Query(new ZodValidationPipe(schema));

export const ZodParam = (schema: ZodType, name: string): ParameterDecorator =>
  Param(name, new ZodValidationPipe(schema));
