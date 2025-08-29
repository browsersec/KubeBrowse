/**
 * Connection states for Guacamole client
 */
export const states = {
  /**
   * The Guacamole connection has not yet been attempted.
   */
  IDLE: "IDLE",

  /**
   * The Guacamole connection is being established.
   */
  CONNECTING: "CONNECTING",

  /**
   * The Guacamole connection has been successfully established, and the
   * client is now waiting for receipt of initial graphical data.
   */
  WAITING: "WAITING",

  /**
   * The Guacamole connection has been successfully established, and
   * initial graphical data has been received.
   */
  CONNECTED: "CONNECTED",

  /**
   * The Guacamole connection has terminated successfully. No errors are
   * indicated.
   */
  DISCONNECTED: "DISCONNECTED",

  /**
   * The Guacamole connection has terminated due to an error reported by
   * the client. The associated error code is stored in statusCode.
   */
  CLIENT_ERROR: "CLIENT_ERROR",

  /**
   * The Guacamole connection has terminated due to an error reported by
   * the tunnel. The associated error code is stored in statusCode.
   */
  TUNNEL_ERROR: "TUNNEL_ERROR"
} as const;

export type ConnectionState = keyof typeof states;

export default states;