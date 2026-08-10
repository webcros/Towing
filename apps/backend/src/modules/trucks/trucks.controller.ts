import {
  Controller,
  Get,
  HttpStatus,
  Post,
  Put,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  complianceUpsertSchema,
  truckCreateSchema,
  truckUpdateSchema,
  trucksListQuerySchema,
  type ComplianceUpsertRequest,
  type FleetId,
  type TruckCreateRequest,
  type TruckUpdateRequest,
  type TrucksListQuery,
} from '@towing/api-contracts';
import { z } from 'zod';
import { ApiException } from '../../common/errors/api-exception';
import { CurrentFleet } from '../../common/tenancy/current-fleet.decorator';
import { FleetScopeGuard } from '../../common/tenancy/fleet-scope.guard';
import { ZodBody, ZodParam, ZodQuery } from '../../common/validation/zod.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { templateCsv, toErrorCsv } from './bulk-import';
import { TruckImportsService } from './imports.service';
import { TrucksService } from './trucks.service';

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** CSV is text; the 2 MB cap covers `BULK_IMPORT_MAX_ROWS` several times over. */
const IMPORT_MIME = new Set(['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv']);
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

@Controller('fleet/trucks')
@UseGuards(JwtAuthGuard, FleetScopeGuard)
export class TrucksController {
  constructor(
    private readonly trucks: TrucksService,
    private readonly imports: TruckImportsService,
  ) {}

  @Get()
  list(@CurrentFleet() fleetId: FleetId, @ZodQuery(trucksListQuerySchema) query: TrucksListQuery) {
    return this.trucks.list(fleetId, query);
  }

  // ── Bulk CSV import (§9.3.4) ──────────────────────────────────────────────
  //
  // Declared BEFORE any `:id` route: Express matches in declaration order, so
  // `template.csv` would otherwise be captured as an import id.

  /** The exact header the parser demands — no guessing what the columns are. */
  @Get('bulk/template.csv')
  template(@Res() res: Response): void {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="truck-import-template.csv"');
    res.send(templateCsv());
  }

  @Get('bulk')
  listImports(@CurrentFleet() fleetId: FleetId) {
    return this.imports.list(fleetId);
  }

  @Get('bulk/:importId')
  getImport(@CurrentFleet() fleetId: FleetId, @ZodParam(z.uuid(), 'importId') importId: string) {
    return this.imports.get(fleetId, importId);
  }

  /** The §9.3.4 downloadable error report: `row, field, code, message`. */
  @Get('bulk/:importId/errors.csv')
  async importErrors(
    @CurrentFleet() fleetId: FleetId,
    @ZodParam(z.uuid(), 'importId') importId: string,
    @Res() res: Response,
  ): Promise<void> {
    const record = await this.imports.get(fleetId, importId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="import-${importId.slice(0, 8)}-errors.csv"`,
    );
    res.send(toErrorCsv(record.errors));
  }

  @Post('bulk')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMPORT_BYTES },
      fileFilter: (_req, file, cb) => {
        // Browsers disagree about the CSV mime type (Excel installs make it
        // application/vnd.ms-excel), so accept the family and let the parser
        // be the real gate.
        if (!IMPORT_MIME.has(file.mimetype)) {
          cb(
            new ApiException(
              HttpStatus.UNPROCESSABLE_ENTITY,
              'validation_failed',
              'Upload a .csv file',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  bulkImport(@CurrentFleet() fleetId: FleetId, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw ApiException.validation('No file was uploaded');
    return this.imports.start(fleetId, file);
  }

  @Post()
  create(@CurrentFleet() fleetId: FleetId, @ZodBody(truckCreateSchema) body: TruckCreateRequest) {
    return this.trucks.create(fleetId, body);
  }

  @Put(':id')
  update(
    @CurrentFleet() fleetId: FleetId,
    @ZodParam(z.uuid(), 'id') truckId: string,
    @ZodBody(truckUpdateSchema) body: TruckUpdateRequest,
  ) {
    return this.trucks.update(fleetId, truckId, body);
  }

  @Post(':id/compliance')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(
            new ApiException(
              HttpStatus.UNPROCESSABLE_ENTITY,
              'validation_failed',
              'Only PDF, JPEG, PNG or WebP documents are accepted',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  upsertCompliance(
    @CurrentFleet() fleetId: FleetId,
    @ZodParam(z.uuid(), 'id') truckId: string,
    @ZodBody(complianceUpsertSchema) body: ComplianceUpsertRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.trucks.upsertCompliance(fleetId, truckId, body, file);
  }
}
