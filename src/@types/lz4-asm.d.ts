declare module 'lz4-asm' {

  interface Lz4InitOptions {
    wasmBinary: ArrayBuffer;
  }

  export interface Lz4 {
    compress(source: Uint8Binary | Buffer): Uint8Binary | Buffer;
    decompress(source: Uint8Binary | Buffer): Uint8Binary | Buffer;
  }

  export function lz4init(options: Lz4InitOptions): Promise<{lz4js: Lz4}>;

  export = lz4init;
}
