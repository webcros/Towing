import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  savedVehicleCreateSchema,
  savedVehicleUpdateSchema,
  vehicleRcConfirmRequestSchema,
  type SavedVehicleCreate,
  type SavedVehicleUpdate,
  type VehicleRcConfirmRequest,
} from '@towing/api-contracts';
import { z } from 'zod';
import { ZodBody, ZodParam } from '../../common/validation/zod.decorators';
import type { AuthedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Realms } from '../auth/realm.decorator';
import { customerId } from './me.controller';
import { MeVehiclesService } from './me-vehicles.service';

@Controller('me/vehicles')
@UseGuards(JwtAuthGuard)
@Realms('customer')
export class MeVehiclesController {
  constructor(private readonly vehicles: MeVehiclesService) {}

  @Get()
  list(@Req() request: AuthedRequest) {
    return this.vehicles.list(customerId(request));
  }

  @Post()
  create(@ZodBody(savedVehicleCreateSchema) body: SavedVehicleCreate, @Req() request: AuthedRequest) {
    return this.vehicles.create(customerId(request), body);
  }

  @Put(':id')
  update(
    @ZodParam(z.uuid(), 'id') vehicleId: string,
    @ZodBody(savedVehicleUpdateSchema) body: SavedVehicleUpdate,
    @Req() request: AuthedRequest,
  ) {
    return this.vehicles.update(customerId(request), vehicleId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@ZodParam(z.uuid(), 'id') vehicleId: string, @Req() request: AuthedRequest): Promise<void> {
    await this.vehicles.remove(customerId(request), vehicleId);
  }

  @Post(':id/rc/presign')
  presignRc(@ZodParam(z.uuid(), 'id') vehicleId: string, @Req() request: AuthedRequest) {
    return this.vehicles.presignRc(customerId(request), vehicleId);
  }

  @Post(':id/rc/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmRc(
    @ZodParam(z.uuid(), 'id') vehicleId: string,
    @ZodBody(vehicleRcConfirmRequestSchema) body: VehicleRcConfirmRequest,
    @Req() request: AuthedRequest,
  ): Promise<void> {
    await this.vehicles.confirmRc(customerId(request), vehicleId, body);
  }
}
