import type { Server } from 'node:http'

export function listenOnPort(server: Server, startPort: number, strictPort: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    const attempt = (port: number) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off('listening', onListening)
        if (!strictPort && (error.code === 'EADDRINUSE' || error.code === 'EACCES')) {
          attempt(port + 1)
          return
        }
        reject(error)
      }
      const onListening = () => {
        server.off('error', onError)
        resolve(port)
      }

      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port, '0.0.0.0')
    }

    attempt(startPort)
  })
}
