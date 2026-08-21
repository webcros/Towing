import { Module } from '@nestjs/common';
import { GeocodingRouterAdapter } from './geocoding-router.adapter';
import { GEOCODING } from './geocoding.port';
import { GooglePlacesAdapter } from './google-places.adapter';
import { LocalGazetteerAdapter } from './local-gazetteer.adapter';

/**
 * `routing.module.ts`'s arrangement, for the same reasons it argues: the factory
 * does not pick an adapter, it always binds the ROUTER, which picks per call and
 * degrades. The provider switch still lives in env; what changes is that a
 * `google_places` deployment keeps answering when Google does not.
 *
 * Both concrete adapters are instantiated whichever way `GEOCODING_PROVIDER` is
 * set — which is exactly why neither constructor may validate a credential or
 * open a connection. `GooglePlacesAdapter` does its check in `onModuleInit`,
 * guarded on the switch.
 *
 * Not `@Global()`: the consumer family is small and explicit (the places routes,
 * and Phase 18's share-trip address labels), so the import edge is worth
 * declaring.
 */
@Module({
  providers: [
    LocalGazetteerAdapter,
    GooglePlacesAdapter,
    GeocodingRouterAdapter,
    { provide: GEOCODING, useExisting: GeocodingRouterAdapter },
  ],
  exports: [GEOCODING, LocalGazetteerAdapter, GooglePlacesAdapter],
})
export class GeocodingModule {}
