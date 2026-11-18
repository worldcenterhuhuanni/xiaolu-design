/**
 * GPU fluid simulation (Stam stable fluids): a velocity field and a dye field. Every disturbance
 * enters through `splat`. Each `step` runs vorticity confinement, divergence, pressure iterations
 * and gradient subtraction, which keeps the flow incompressible so it rolls into eddies, then advection.
 */
import * as THREE from 'three';
/** Running simulation bound to one renderer. */
export interface Fluid {
    readonly dye: THREE.Texture;
    readonly vel: THREE.Texture;
    /**
     * Inject velocity and color at one point.
     * @param x - horizontal position, 0 to 1 from the left.
     * @param y - vertical position, 0 to 1 from the bottom.
     * @param dx - horizontal velocity.
     * @param dy - vertical velocity.
     * @param rgb - linear color added to the dye.
     * @param radius - squared Gaussian radius.
     */
    splat(x: number, y: number, dx: number, dy: number, rgb: readonly [number, number, number], radius?: number): void;
    /** Advance the simulation. @param dt - seconds since the previous step. */
    step(dt: number): void;
    /** Release every render target and material. */
    dispose(): void;
}
/**
 * Create the simulation.
 * @param renderer - renderer whose context owns the simulation textures.
 * @param aspect - current width over height of the drawing surface.
 * @returns the simulation.
 */
export declare function createFluid(renderer: THREE.WebGLRenderer, aspect: () => number): Fluid;
//# sourceMappingURL=fluid.d.ts.map