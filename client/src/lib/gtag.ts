export const AW_ID = 'AW-18117270581';

// conversionLabel comes from Google Ads UI → Tools → Conversions → tag snippet's "send_to" suffix
// Returns a promise that resolves once gtag has dispatched the event (or after 1s timeout as fallback)
export function fireConversion(conversionLabel: string, value?: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.gtag !== 'function') { resolve(); return; }
    const timer = setTimeout(resolve, 1000);
    window.gtag('event', 'conversion', {
      send_to: `${AW_ID}/${conversionLabel}`,
      ...(value !== undefined && { value, currency: 'INR' }),
      event_callback: () => { clearTimeout(timer); resolve(); },
    });
  });
}
