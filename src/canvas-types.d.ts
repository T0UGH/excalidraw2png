declare module "wawoff2" {
  export function decompress(data: Buffer | Uint8Array): Promise<Uint8Array>;
  export function compress(data: Buffer | Uint8Array): Promise<Uint8Array>;
}
