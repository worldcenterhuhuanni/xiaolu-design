/** Particle formation while the answer is being produced: orbiting the answer, or drawn down spiral arms. */
export type BackgroundEffect = 'ring' | 'vortex';
/** Scene behind the conversation. */
export type BackgroundScene = 'river' | 'stars';
/** Running background; assign the fields to steer it. */
export interface Background {
    energy: number;
    theme: {
        readonly h: number;
        readonly h2: number;
        readonly sat: number;
    };
    effect: BackgroundEffect;
    scene: BackgroundScene;
    /**
     * Raise a ring of spray and a shock wave.
     * @param clientX - viewport x of the point.
     * @param clientY - viewport y of the point.
     * @param warm - use amber, for a sent question.
     */
    splash(clientX: number, clientY: number, warm?: boolean): void;
    /** Stop rendering and release the WebGL resources and listeners. */
    dispose(): void;
}
/**
 * Start the background on a canvas sized by CSS.
 * @param canvas - canvas element already in the document.
 * @returns the running background.
 */
export declare function createBackground(canvas: HTMLCanvasElement): Background;
//# sourceMappingURL=bg.d.ts.map