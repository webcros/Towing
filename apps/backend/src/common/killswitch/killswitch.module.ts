import { Global, Module } from '@nestjs/common';
import { KillSwitchService } from './killswitch.service';

/**
 * §19.8's kill switches.
 *
 * `@Global()`, like `CacheModule` and `RedisModule`, because the switches are
 * read from three places that do not otherwise know about each other: the
 * dispatch engine (is this zone paused?), and all THREE realtime ticket routes
 * (`/fleet`, `/driver`, `/customer`), which refuse to mint when polling is
 * forced. Making each of them import a dispatch module to reach a Redis flag
 * would be an import edge that says something untrue about the dependency.
 *
 * It lives in `common/` for the same reason: it has no domain knowledge at all
 * — three keys and a fail-open read.
 */
@Global()
@Module({
  providers: [KillSwitchService],
  exports: [KillSwitchService],
})
export class KillSwitchModule {}
