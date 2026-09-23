/**
 * Ambient contract of the DSH browser-half loader.
 *
 * A client plugin is *not* bundled: `dsh-client-modules` serves this file inside
 * `window.__ModuleLoader__.load({ id, factory })`, and the factory receives a
 * CommonJS-style `require` that resolves the host's shared modules. That is why
 * `react`, `react/jsx-runtime`, and the Cordis context are declared here instead
 * of being imported — importing them would ask Node to resolve packages the
 * browser half never resolves itself.
 *
 * The declarations deliberately cover only the surface this plugin uses.
 */

// @jsxRuntime automatic
// @jsxImportSource react

declare const React: {
  useState<S>(initial: () => S): [S, (next: S) => void]
  useEffect(effect: () => void | (() => void), deps: readonly unknown[]): void
}

declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    div: {
      className?: string
      children?: unknown
      [dataAttribute: `data-${string}`]: string | undefined
    }
    span: {
      className?: string
      children?: unknown
    }
  }
}

declare interface Window {
  setInterval(handler: () => void, timeout: number): number
  clearInterval(handle: number): void
}

declare const window: Window

/** One sanitized value the plugin may render. */
type DshSlotChild = { type: string; props: Record<string, unknown> } | string

/** Slot component contract: receives the slot's props, returns a render tree. */
type DshSlotComponent = (props: never) => JSX.Element

/** Registered-but-disposed entry handle returned by the renderer's `slots.inject`. */
type DshSlotDisposer = () => void

interface DshSlotsService {
  /**
   * Wait for a slot declaration, then run `callback`; the callback returns a
   * disposer for the contribution it just registered. Collapsing the
   * declaration disposes the effect and a later declaration runs it again.
   */
  inject(key: string, callback: () => DshSlotDisposer): DshSlotDisposer
  /** Contribute one component to a declared list slot. */
  register(
    options: {
      name: string
      id: string
      order?: number
      label?: () => string
    },
    component: DshSlotComponent,
  ): DshSlotDisposer
}

interface DshPluginContext {
  slots: DshSlotsService
  /** Bind an effect to the plugin fiber; the returned disposer releases it. */
  effect(effect: () => void | (() => void), label?: string): DshSlotDisposer
}
