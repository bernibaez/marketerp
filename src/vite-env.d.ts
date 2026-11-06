/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'jsbarcode' {
  export interface JsBarcodeOptions {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    font?: string;
    fontSize?: number;
    textAlign?: string;
    textPosition?: string;
    textMargin?: number;
    margin?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    background?: string;
    lineColor?: string;
    valid?: (valid: boolean) => void;
    [key: string]: unknown;
  }

  function JsBarcode(
    element: Element | string,
    data: string,
    options?: JsBarcodeOptions
  ): void;

  export default JsBarcode;
}
