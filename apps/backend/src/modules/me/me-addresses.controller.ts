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
  savedAddressCreateSchema,
  savedAddressUpdateSchema,
  type SavedAddressCreate,
  type SavedAddressUpdate,
} from '@towing/api-contracts';
import { z } from 'zod';
import { ZodBody, ZodParam } from '../../common/validation/zod.decorators';
import type { AuthedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Realms } from '../auth/realm.decorator';
import { customerId } from './me.controller';
import { MeAddressesService } from './me-addresses.service';

@Controller('me/addresses')
@UseGuards(JwtAuthGuard)
@Realms('customer')
export class MeAddressesController {
  constructor(private readonly addresses: MeAddressesService) {}

  @Get()
  list(@Req() request: AuthedRequest) {
    return this.addresses.list(customerId(request));
  }

  @Post()
  create(@ZodBody(savedAddressCreateSchema) body: SavedAddressCreate, @Req() request: AuthedRequest) {
    return this.addresses.create(customerId(request), body);
  }

  @Put(':id')
  update(
    @ZodParam(z.uuid(), 'id') addressId: string,
    @ZodBody(savedAddressUpdateSchema) body: SavedAddressUpdate,
    @Req() request: AuthedRequest,
  ) {
    return this.addresses.update(customerId(request), addressId, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@ZodParam(z.uuid(), 'id') addressId: string, @Req() request: AuthedRequest): Promise<void> {
    await this.addresses.remove(customerId(request), addressId);
  }
}
