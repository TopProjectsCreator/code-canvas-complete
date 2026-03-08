declare module 'scratch-storage' {
  class ScratchStorage {
    constructor();
    AssetType: {
      ImageVector: string;
      ImageBitmap: string;
      Sound: string;
      [key: string]: string;
    };
    DataFormat: {
      SVG: string;
      PNG: string;
      WAV: string;
      MP3: string;
      [key: string]: string;
    };
    addWebStore(
      types: string[],
      getFunction: (asset: { assetId: string; dataFormat: string }) => string,
      setFunction?: (asset: { assetId: string; dataFormat: string }) => string
    ): void;
    load(assetType: string, assetId: string, dataFormat?: string): Promise<unknown>;
  }
  export default ScratchStorage;
}
