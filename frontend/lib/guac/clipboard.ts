import Guacamole from 'guacamole-common-js';

export interface ClipboardData {
  type: string;
  data: string | Blob;
}

export interface GuacamoleClient {
  createClipboardStream: (type: string) => any;
}

class ClipboardManager {
  private cache: ClipboardData | null = null;

  install(client: GuacamoleClient): void {
    // Don't automatically try to read clipboard on load - wait for user interaction
    window.addEventListener('copy', () => this.update(client)());
    window.addEventListener('cut', () => this.update(client)());
    window.addEventListener('focus', (e) => {
      if (e.target === window) {
        // Only try clipboard operations after user interaction
        if (document.hasFocus()) {
          this.update(client)();
        }
      }
    }, true);
  }

  update = (client: GuacamoleClient) => {
    return () => {
      this.getLocalClipboard()
        .then(data => {
          if (data) {
            this.cache = data;
            this.setRemoteClipboard(client);
          }
        })
        .catch(err => {
          // Silently handle clipboard permission errors
          console.debug('Clipboard access not permitted:', err);
        });
    };
  };

  private setRemoteClipboard(client: GuacamoleClient): void {
    if (!this.cache) {
      return;
    }

    let writer: any;

    const stream = client.createClipboardStream(this.cache.type);

    if (typeof this.cache.data === 'string') {
      writer = new Guacamole.StringWriter(stream);
      writer.sendText(this.cache.data);
      writer.sendEnd();
    } else {
      writer = new Guacamole.BlobWriter(stream);
      writer.oncomplete = function clipboardSent() {
        writer.sendEnd();
      };
      writer.sendBlob(this.cache.data);
    }
  }

  private async getLocalClipboard(): Promise<ClipboardData | null> {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        return {
          type: 'text/plain',
          data: text
        };
      }
    } catch (error) {
      // Return null instead of failing if clipboard permission is denied
      return null;
    }
    return null;
  }

  private async setLocalClipboard(data: ClipboardData): Promise<void> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        if (data.type === 'text/plain' && typeof data.data === 'string') {
          await navigator.clipboard.writeText(data.data);
        }
      }
    } catch (error) {
      console.debug('Could not write to clipboard:', error);
    }
  }

  onClipboard = (stream: any, mimetype: string): void => {
    let reader: any;

    if (/^text\//.exec(mimetype)) {
      reader = new Guacamole.StringReader(stream);

      // Assemble received data into a single string
      let data = '';
      reader.ontext = (text: string) => {
        data += text;
      };

      // Set clipboard contents once stream is finished
      reader.onend = () => {
        this.setLocalClipboard({
          type: mimetype,
          data: data
        });
      };
    } else {
      reader = new Guacamole.BlobReader(stream, mimetype);
      reader.onend = () => {
        this.setLocalClipboard({
          type: mimetype,
          data: reader.getBlob()
        });
      };
    }
  };
}

const clipboard = new ClipboardManager();
export default clipboard;