/// <reference types="vite/client" />

declare module "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm" {
  export function feature(topology: unknown, object: unknown): unknown;
  export function mesh(topology: unknown, object: unknown, filter?: unknown): unknown;
}
