import { buildHandler, type HandlerOverride } from './build-handler.js';

declare global {
  interface Window {
    __mswControl?: {
      use: (overrides: HandlerOverride[]) => void;
      reset: () => void;
    };
    /** Set via page.addInitScript so overrides are active before the app's first render/fetch. */
    __pendingMswOverrides?: HandlerOverride[];
  }
}

export async function initMocks(): Promise<void> {
  const { worker } = await import('./browser.js');
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });

  if (window.__pendingMswOverrides?.length) {
    worker.use(...window.__pendingMswOverrides.map(buildHandler));
  }

  window.__mswControl = {
    use: (overrides) => worker.use(...overrides.map(buildHandler)),
    reset: () => worker.resetHandlers(),
  };
}
