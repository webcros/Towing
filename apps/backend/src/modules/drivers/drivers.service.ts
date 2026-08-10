import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  ErrorCodes,
  rupeeStringToPaise,
  type AssignTruckRequest,
  type DriverInviteRequest,
  type DriversListResponse,
  type FleetDriverDto,
  type FleetId,
} from '@towing/api-contracts';
import type { PageQuery } from '@towing/api-contracts';
import { ApiException } from '../../common/errors/api-exception';
import { FleetEventsService } from '../../common/events/fleet-events.service';
import { isUniqueViolation } from '../../common/errors/pg-errors';
import {
  NOTIFICATIONS,
  type NotificationPort,
} from '../../common/notifications/notification.port';
import { istMonthStart } from '../../common/time/ist';
import { DriversRepo, type DriverRow } from './drivers.repo';

function toDto(row: DriverRow, plate: string | null, monthNet: string | undefined): FleetDriverDto {
  return {
    id: row.id,
    name: row.name ?? '—',
    phone: row.mobile,
    kycStatus: row.kycStatus,
    isOnline: row.isOnline,
    assignedTruckPlate: plate,
    rating: row.rating === null ? null : Number(row.rating),
    tripsTotal: row.totalTrips,
    monthNetPaise: monthNet ? rupeeStringToPaise(monthNet) : 0,
  };
}

@Injectable()
export class DriversService {
  constructor(
    private readonly repo: DriversRepo,
    private readonly events: FleetEventsService,
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationPort,
  ) {}

  async list(fleetId: FleetId, query: PageQuery): Promise<DriversListResponse> {
    const { rows, total } = await this.repo.listPage(fleetId, query);

    const truckIds = rows
      .map((d) => d.assignedTruckId)
      .filter((id): id is string => id !== null);
    const [plates, monthNets] = await Promise.all([
      this.repo.platesFor(truckIds),
      this.repo.monthNetFor(
        rows.map((d) => d.id),
        istMonthStart(),
      ),
    ]);

    return {
      items: rows.map((d) =>
        toDto(
          d,
          d.assignedTruckId ? (plates.get(d.assignedTruckId) ?? null) : null,
          monthNets.get(d.id),
        ),
      ),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  async invite(fleetId: FleetId, body: DriverInviteRequest): Promise<FleetDriverDto> {
    let row: DriverRow;
    try {
      row = await this.repo.invite(fleetId, {
        name: body.name,
        mobile: body.mobile,
        vehicleClass: body.vehicleClass ?? null,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          ErrorCodes.DUPLICATE_MOBILE,
          'A driver with this mobile number already exists on the platform',
        );
      }
      throw err;
    }

    // The driver finishes KYC in TowPartner; approval stays with platform admin.
    await this.notifications.notify({
      to: body.mobile,
      channel: 'sms',
      template: 'fleet_driver_invite',
      variables: { name: body.name },
    });

    return toDto(row, null, undefined);
  }

  async assignTruck(
    fleetId: FleetId,
    driverId: string,
    body: AssignTruckRequest,
  ): Promise<FleetDriverDto> {
    const driver = await this.repo.findById(fleetId, driverId);
    if (!driver) throw ApiException.notFound('Driver not found');

    if (body.truckId !== null && !(await this.repo.truckInFleet(fleetId, body.truckId))) {
      // Cross-tenant truck ids are indistinguishable from unknown ones.
      throw ApiException.notFound('Truck not found');
    }

    let updated: DriverRow | undefined;
    try {
      updated = await this.repo.setAssignedTruck(fleetId, driverId, body.truckId);
    } catch (err) {
      // The partial unique index is the race-safe arbiter of one-driver-per-truck.
      if (isUniqueViolation(err)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          ErrorCodes.TRUCK_ALREADY_ASSIGNED,
          'This truck is already assigned to another driver',
        );
      }
      throw err;
    }
    if (!updated) throw ApiException.notFound('Driver not found');

    // `utilizationPct` counts DISTINCT drivers.assigned_truck_id on active
    // bookings, so this mutation moves its numerator. Before Phase 5 nothing
    // here invalidated `dash:{fleetId}` and the KPI stayed wrong for up to the
    // 15s TTL — the reason this seam is now a single service.
    // `invite` deliberately does NOT emit: no KPI reads driver count.
    await this.events.emit(fleetId, { kind: 'driver_assignment_changed', driverId });

    const plates = updated.assignedTruckId
      ? await this.repo.platesFor([updated.assignedTruckId])
      : new Map<string, string>();

    return toDto(
      updated,
      updated.assignedTruckId ? (plates.get(updated.assignedTruckId) ?? null) : null,
      undefined,
    );
  }
}
