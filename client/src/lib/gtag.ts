export const AW_ID = 'AW-18117270581';

// conversionLabel comes from Google Ads UI → Tools → Conversions → tag snippet's "send_to" suffix
export function fireConversion(conversionLabel: string, value?: number) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'conversion', {
    send_to: `${AW_ID}/${conversionLabel}`,
    ...(value !== undefined && { value, currency: 'INR' }),
  });
}
