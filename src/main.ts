import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// pdf.js v6 relies on Promise.try, which is missing in some browsers (older
// Safari/Firefox/WebView). Polyfill it before any pdf.js code runs.
if (typeof (Promise as unknown as { try?: unknown }).try !== 'function') {
  (Promise as unknown as { try: unknown }).try = function <T>(
    fn: (...args: unknown[]) => T,
    ...args: unknown[]
  ): Promise<T> {
    try {
      return Promise.resolve(fn(...args));
    } catch (err) {
      return Promise.reject(err);
    }
  };
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
