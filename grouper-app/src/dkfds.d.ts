declare module 'dkfds' {
  export function init(options?: unknown): void;

  export class Modal {
    constructor(element: HTMLElement);
    init(): void;
    show(event?: Event | null): void;
    hide(): void;
  }
}
