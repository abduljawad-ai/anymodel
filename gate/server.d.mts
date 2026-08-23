/** Starts the relay-gate server. Returns the listening http.Server. */
export function start(opts?: { port?: number }): import('node:http').Server;
