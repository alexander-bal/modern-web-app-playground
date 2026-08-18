import type { Page } from '@playwright/test';
import type { HandlerOverride } from '../../src/mocks/build-handler.js';

/** Registers per-test MSW overrides against the page's in-browser worker (see src/mocks/init.ts). */
export class MswControl {
  constructor(private readonly page: Page) {}

  /**
   * Registers overrides before navigation, via an init script. Required for any handler that
   * must be active for the app's first render (e.g. auth state, initial cart/address fetch) —
   * `use()` runs after the page has loaded and would race the app's mount-time fetches.
   */
  async useBeforeLoad(...overrides: HandlerOverride[]): Promise<void> {
    await this.page.addInitScript((newOverrides) => {
      window.__pendingMswOverrides = [...(window.__pendingMswOverrides ?? []), ...newOverrides];
    }, overrides);
  }

  /**
   * Registers overrides on an already-loaded page, e.g. before a user-triggered mutation. Waits
   * for the worker bridge, since it's set asynchronously shortly after the page's `load` event
   * (see src/mocks/init.ts) and `page.goto()` doesn't wait for it.
   */
  async use(...overrides: HandlerOverride[]): Promise<void> {
    await this.page.waitForFunction(() => window.__mswControl !== undefined);
    await this.page.evaluate((newOverrides) => {
      window.__mswControl?.use(newOverrides);
    }, overrides);
  }

  async reset(): Promise<void> {
    await this.page.waitForFunction(() => window.__mswControl !== undefined);
    await this.page.evaluate(() => window.__mswControl?.reset());
  }
}
