/**
 * WebSocket 实时推送模块
 * 
 * 基于 Node.js 内置 HTTP 服务器升级实现，
 * 零第三方依赖的 WebSocket 支持。
 * 
 * 协议：RFC 6455 WebSocket
 */

import { createHash, randomUUID } from "node:crypto";

const WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-5AB9DC76B46D";

/**
 * 创建 WebSocket 服务器
 * @param {object} options
 * @param {import("node:http").Server} options.httpServer - HTTP 服务器实例
 * @param {Function} [options.onConnection] - 新连接回调
 * @param {Function} [options.onMessage] - 消息回调
 * @param {Function} [options.onDisconnect] - 断开连接回调
 */
export function createWebSocketServer({ httpServer, onConnection, onMessage, onDisconnect } = {}) {
  const clients = new Map(); // id -> { ws, subscriptions }
  
  // 拦截 HTTP upgrade 请求
  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, "http://localhost");
    
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    
    // 验证 WebSocket 握手
    const key = request.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }
    
    const acceptKey = createHash("sha1")
      .update(key + WS_MAGIC_GUID)
      .digest("base64");
    
    const responseHeaders = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "",
      "",
    ].join("\r\n");
    
    socket.write(responseHeaders);
    
    const clientId = randomUUID();
    const client = {
      id: clientId,
      socket,
      subscriptions: new Set(["*"]), // 默认订阅所有事件
      alive: true,
    };
    
    clients.set(clientId, client);
    
    if (onConnection) {
      onConnection(clientId);
    }
    
    // 发送欢迎消息
    sendToClient(client, {
      type: "connected",
      clientId,
      timestamp: new Date().toISOString(),
    });
    
    // 处理消息
    let buffer = Buffer.alloc(0);
    
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      
      while (buffer.length >= 2) {
        const [firstByte, secondByte] = buffer;
        const opcode = firstByte & 0x0f;
        const isMasked = (secondByte & 0x80) !== 0;
        let payloadLength = secondByte & 0x7f;
        let offset = 2;
        
        if (payloadLength === 126) {
          if (buffer.length < 4) break;
          payloadLength = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLength === 127) {
          if (buffer.length < 10) break;
          payloadLength = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }
        
        const totalLength = offset + (isMasked ? 4 : 0) + payloadLength;
        if (buffer.length < totalLength) break;
        
        let payload = buffer.subarray(offset + (isMasked ? 4 : 0), totalLength);
        
        if (isMasked) {
          const mask = buffer.subarray(offset, offset + 4);
          for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4];
          }
        }
        
        if (opcode === 0x08) {
          // Close frame
          socket.end();
          break;
        } else if (opcode === 0x09) {
          // Ping - send Pong
          sendPong(socket, payload);
        } else if (opcode === 0x0a) {
          // Pong - mark alive
          client.alive = true;
        } else if (opcode === 0x01) {
          // Text frame
          try {
            const message = JSON.parse(payload.toString("utf8"));
            if (onMessage) {
              onMessage(clientId, message);
            }
            // 处理订阅请求
            if (message.type === "subscribe" && Array.isArray(message.events)) {
              for (const event of message.events) {
                client.subscriptions.add(event);
              }
            } else if (message.type === "unsubscribe" && Array.isArray(message.events)) {
              for (const event of message.events) {
                client.subscriptions.delete(event);
              }
            }
          } catch {
            // 忽略无效消息
          }
        }
        
        buffer = buffer.subarray(totalLength);
      }
    });
    
    socket.on("close", () => {
      clients.delete(clientId);
      if (onDisconnect) {
        onDisconnect(clientId);
      }
    });
    
    socket.on("error", () => {
      clients.delete(clientId);
    });
  });
  
  // 心跳检测
  const heartbeatInterval = setInterval(() => {
    for (const [id, client] of clients) {
      if (!client.alive) {
        client.socket.destroy();
        clients.delete(id);
        continue;
      }
      client.alive = false;
      sendPing(client.socket);
    }
  }, 30000);
  
  heartbeatInterval.unref();
  
  /**
   * 广播事件给所有订阅的客户端
   */
  function broadcast(event, data) {
    const message = JSON.stringify({
      type: "event",
      event,
      data,
      timestamp: new Date().toISOString(),
    });
    
    for (const [, client] of clients) {
      if (client.subscriptions.has("*") || client.subscriptions.has(event)) {
        client.socket.write(encodeFrame(message));
      }
    }
  }
  
  /**
   * 发送给指定客户端
   */
  function sendToClient(client, data) {
    const message = JSON.stringify(data);
    client.socket.write(encodeFrame(message));
  }
  
  /**
   * 获取连接数
   */
  function getConnectionCount() {
    return clients.size;
  }
  
  /**
   * 获取客户端信息
   */
  function getClients() {
    return Array.from(clients.values()).map(c => ({
      id: c.id,
      subscriptions: Array.from(c.subscriptions),
      alive: c.alive,
    }));
  }
  
  return { broadcast, sendToClient, getConnectionCount, getClients };
}

function encodeFrame(data) {
  const payload = Buffer.from(data, "utf8");
  let header;
  
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + Text
    header[1] = payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  
  return Buffer.concat([header, payload]);
}

function sendPing(socket) {
  const frame = Buffer.from([0x89, 0x00]);
  socket.write(frame);
}

function sendPong(socket, payload) {
  const frame = Buffer.alloc(2 + payload.length);
  frame[0] = 0x8a;
  frame[1] = payload.length;
  payload.copy(frame, 2);
  socket.write(frame);
}
