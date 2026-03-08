declare module 'scratch-render' {
  class RenderWebGL {
    constructor(canvas: HTMLCanvasElement);
    draw(): void;
    resize(width: number, height: number): void;
    setLayerGroupOrdering(groupOrdering: string[]): void;
    destroy(): void;
    createDrawable(group: string): number;
    updateDrawableProperties(drawableID: number, properties: Record<string, unknown>): void;
    getFencedPositionOfDrawable(drawableID: number): [number, number];
    canvas: HTMLCanvasElement;
  }
  export default RenderWebGL;
}
