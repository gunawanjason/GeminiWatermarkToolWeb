/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

/* eslint-disable */
declare module '*.astro' {
  interface AstroInstance {
    default: any;
  }
  const instance: AstroInstance;
  export default instance;
}

// Allow standard HTML attributes in Astro templates
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
