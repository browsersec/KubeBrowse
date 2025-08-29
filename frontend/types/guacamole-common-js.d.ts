declare module 'guacamole-common-js' {
  export interface Client {
    connect(data: string): void;
    disconnect(): void;
    getDisplay(): any;
    sendKeyEvent(pressed: number, keysym: number): void;
    sendMouseState(mouseState: any): void;
    sendSize(width: number, height: number): void;
    createArgumentValueStream(mimetype: string, name: string): any;
    createClipboardStream(mimetype: string): any;
    onclipboard?: (stream: any, mimetype: string) => void;
    onargv?: (stream: any, mimetype: string, name: string) => void;
    onerror?: (error: any) => void;
    onstatechange?: (state: number) => void;
  }

  export interface Tunnel {
    connect(data: string): void;
    disconnect(): void;
    sendMessage(msg: string): void;
    onerror?: (status: any) => void;
    onstatechange?: (state: any) => void;
    state: any;
  }

  export class WebSocketTunnel implements Tunnel {
    constructor(url: string);
    connect(data: string): void;
    disconnect(): void;
    sendMessage(msg: string): void;
    onerror?: (status: any) => void;
    onstatechange?: (state: any) => void;
    state: any;
    websocket: any;
    _setState(state: any): void;
  }

  export class HTTPTunnel implements Tunnel {
    constructor(url: string, crossDomain?: boolean);
    connect(data: string): void;
    disconnect(): void;
    sendMessage(msg: string): void;
    onerror?: (status: any) => void;
    onstatechange?: (state: any) => void;
    state: any;
  }

  export class StringReader {
    constructor(stream: any);
    ontext?: (text: string) => void;
    onend?: () => void;
  }

  export class StringWriter {
    constructor(stream: any);
    sendText(text: string): void;
    sendEnd(): void;
  }

  export class BlobReader {
    constructor(stream: any, mimetype: string);
    onend?: () => void;
    getBlob(): Blob;
  }

  export class BlobWriter {
    constructor(stream: any);
    sendBlob(blob: Blob): void;
    sendEnd(): void;
    oncomplete?: () => void;
  }

  export class Keyboard {
    constructor(element: HTMLElement);
    onkeydown?: (keysym: number) => void;
    onkeyup?: (keysym: number) => void;
  }

  export namespace Mouse {
    export class State {
      constructor(x: number, y: number, left: boolean, middle: boolean, right: boolean, up: boolean, down: boolean);
      x: number;
      y: number;
      left: boolean;
      middle: boolean;
      right: boolean;
      up: boolean;
      down: boolean;
      fromClientPosition(element: HTMLElement, x: number, y: number): void;
    }

    export class Touchpad {
      // Add touchpad-specific properties and methods if needed
    }

    export class Touchscreen {
      // Add touchscreen-specific properties and methods if needed
    }
  }

  export namespace Tunnel {
    export const State: {
      CONNECTING: any;
      OPEN: any;
      CLOSED: any;
      UNSTABLE: any;
    };
  }

  export class Client {
    constructor(tunnel: Tunnel);
    connect(data: string): void;
    disconnect(): void;
    getDisplay(): any;
    sendKeyEvent(pressed: number, keysym: number): void;
    sendMouseState(mouseState: any): void;
    sendSize(width: number, height: number): void;
    createArgumentValueStream(mimetype: string, name: string): any;
    createClipboardStream(mimetype: string): any;
    onclipboard?: (stream: any, mimetype: string) => void;
    onargv?: (stream: any, mimetype: string, name: string) => void;
    onerror?: (error: any) => void;
    onstatechange?: (state: number) => void;
  }

  const Guacamole: {
    Client: typeof Client;
    WebSocketTunnel: typeof WebSocketTunnel;
    HTTPTunnel: typeof HTTPTunnel;
    StringReader: typeof StringReader;
    StringWriter: typeof StringWriter;
    BlobReader: typeof BlobReader;
    BlobWriter: typeof BlobWriter;
    Keyboard: typeof Keyboard;
    Mouse: typeof Mouse;
    Tunnel: typeof Tunnel;
  };

  export default Guacamole;
}