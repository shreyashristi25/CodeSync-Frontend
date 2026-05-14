declare module 'sockjs-client' {
  export default class SockJS {
    constructor(url: string, protocols?: string | string[] | null, options?: Record<string, unknown>);
    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    close(code?: number, reason?: string): void;
    send(data: string): void;
    readonly readyState: number;
  }
}
