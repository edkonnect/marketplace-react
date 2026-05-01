/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID: string;
}

interface Window {
  gtag: (...args: unknown[]) => void;
  dataLayer: unknown[];
}
