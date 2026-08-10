import { Global, Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';

/**
 * `@Global()` for the same reason CacheModule and QueueModule are: the ledger
 * is infrastructure, and requiring every money-touching feature module to
 * import it would be ceremony that also makes "who writes the ledger?" harder
 * to answer, not easier.
 */
@Global()
@Module({
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
