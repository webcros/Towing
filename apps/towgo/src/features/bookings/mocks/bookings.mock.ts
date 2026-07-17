import type { Booking } from '../types';

const truck1 = require('@/assets/illustrations/booking-truck-1.png');
const truck2 = require('@/assets/illustrations/booking-truck-2.png');

export const bookingsMock: Booking[] = [
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
  },
];
