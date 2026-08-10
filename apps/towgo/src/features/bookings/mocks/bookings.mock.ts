import type { Booking, BookingDetail } from '../types';

const truck1 = require('@/assets/illustrations/booking-truck-1.png');
const truck2 = require('@/assets/illustrations/booking-truck-2.png');
const avatar = require('@/assets/illustrations/avatar-placeholder.png');

/**
 * Detail rows are the single source of truth so the list and the details screen
 * can never drift. Reference format: "TG" + DDMMYY + HHMM of the pickup slot.
 */
export const bookingDetailsMock: BookingDetail[] = [
  {
    id: 'b1',
    originLabel: 'MG Road, Bengaluru',
    destinationLabel: 'Koramangala, Bengaluru',
    date: '17 May 2024',
    time: '10:30 AM',
    status: 'completed',
    fare: 1250,
    routeTone: 'success',
    vehiclePlate: 'KA 01 AB 1234',
    driverName: 'Rajesh Kumar',
    driverRating: 4.8,
    truckImage: truck1,
    reference: 'TG1705241030',
    towTypeId: 'light',
    durationMinutes: 45,
    distanceKm: 8.6,
    paymentMethod: 'card',
    driverPhoto: avatar,
    driverTrips: 128,
  },
  {
    id: 'b4',
    originLabel: 'Whitefield, Bengaluru',
    destinationLabel: 'Electronic City, Bengaluru',
    date: '16 May 2024',
    time: '4:20 PM',
    status: 'completed',
    fare: 1350,
    routeTone: 'info',
    vehiclePlate: 'KA 03 CD 5678',
    driverName: 'Sandeep Yadav',
    driverRating: 4.7,
    truckImage: truck2,
    reference: 'TG1605241620',
    towTypeId: 'light',
    durationMinutes: 55,
    distanceKm: 18.3,
    paymentMethod: 'wallet',
    driverPhoto: avatar,
    driverTrips: 76,
  },
  {
    id: 'b2',
    originLabel: 'HSR Layout, Bengaluru',
    destinationLabel: 'Jayanagar, Bengaluru',
    date: '15 May 2024',
    time: '11:45 AM',
    status: 'completed',
    fare: 1100,
    routeTone: 'info',
    vehiclePlate: 'KA 02 EF 9012',
    driverName: 'Vikram Singh',
    driverRating: 4.9,
    truckImage: truck2,
    reference: 'TG1505241145',
    towTypeId: 'light',
    durationMinutes: 35,
    distanceKm: 6.2,
    paymentMethod: 'upi',
    driverPhoto: avatar,
    driverTrips: 214,
  },
  {
    id: 'b3',
    originLabel: 'Indiranagar, Bengaluru',
    destinationLabel: 'Whitefield, Bengaluru',
    date: '9 May 2024',
    time: '6:15 PM',
    status: 'completed',
    fare: 2450,
    routeTone: 'success',
    vehiclePlate: 'KA 05 CJ 8890',
    driverName: 'Imran Sheikh',
    driverRating: 4.7,
    truckImage: truck1,
    reference: 'TG0905241815',
    towTypeId: 'medium',
    durationMinutes: 80,
    distanceKm: 21.4,
    paymentMethod: 'card',
    driverPhoto: avatar,
    driverTrips: 96,
  },
];

/** List payload — the detail rows seen through the narrower list type. */
export const bookingsMock: Booking[] = bookingDetailsMock;
