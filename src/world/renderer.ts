import { PCFShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';

/** Thrown when no WebGL context can be created; main shows a German message for it. */
export class WebGLUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('WebGL is not available');
    this.name = 'WebGLUnavailableError';
    if (cause !== undefined) this.cause = cause;
  }
}

export function createRenderer(container: HTMLElement): WebGLRenderer {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    throw new WebGLUnavailableError(error);
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap was removed in three r186; PCFShadowMap is filtered/soft in this version.
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);
  return renderer;
}
