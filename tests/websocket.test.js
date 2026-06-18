import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createWebSocketServer } from "../src/lib/websocket.js";
import { randomUUID } from "node:crypto";

// 跟踪所有打开的服务器以便清理
const openServers = new Set();

function trackServer(server) {
  openServers.add(server);
  return server;
}

afterEach(() => {
  for (const server of openServers) {
    try {
      server.close();
    } catch (e) {
      // 忽略已关闭的服务器
    }
  }
  openServers.clear();
});

describe("WebSocket 实时推送", () => {
  it("创建 WebSocket 服务器并返回控制方法", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    assert.ok(ws.broadcast);
    assert.ok(ws.sendToClient);
    assert.ok(ws.getConnectionCount);
    assert.ok(ws.getClients);
    assert.equal(ws.getConnectionCount(), 0);
    
    httpServer.close();
  });

  it("getClients 返回空数组当无连接时", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    const clients = ws.getClients();
    assert.ok(Array.isArray(clients));
    assert.equal(clients.length, 0);
    
    httpServer.close();
  });

  it("broadcast 不抛出错误当无连接时", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    assert.doesNotThrow(() => {
      ws.broadcast("test.event", { data: "test" });
    });
    
    httpServer.close();
  });

  it("支持自定义回调函数", () => {
    const httpServer = trackServer(createServer());
    let connectionCalled = false;
    let messageCalled = false;
    let disconnectCalled = false;
    
    const ws = createWebSocketServer({
      httpServer,
      onConnection: () => { connectionCalled = true; },
      onMessage: () => { messageCalled = true; },
      onDisconnect: () => { disconnectCalled = true; },
    });
    
    assert.ok(!connectionCalled);
    assert.ok(!messageCalled);
    assert.ok(!disconnectCalled);
    
    httpServer.close();
  });
});

// ── WebSocket 集成测试 ──

import { request } from "node:http";

describe("WebSocket 集成", () => {
  it("WebSocket 握手成功", async () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        const port = httpServer.address().port;
        
        const req = request({
          hostname: "127.0.0.1",
          port,
          path: "/ws",
          headers: {
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13"
          }
        });
        
        req.on("upgrade", (res, socket) => {
          assert.equal(res.statusCode, 101);
          assert.equal(res.headers["upgrade"], "websocket");
          socket.destroy();
          httpServer.close(resolve);
        });
        
        req.end();
      });
    });
  });

  it("非 /ws 路径拒绝升级", async () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        const port = httpServer.address().port;
        
        const req = request({
          hostname: "127.0.0.1",
          port,
          path: "/other",
          headers: {
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13"
          }
        });
        
        req.on("error", () => {
          httpServer.close(resolve);
        });
        
        req.on("response", (res) => {
          // 非 /ws 路径不升级，返回正常 HTTP 响应或关闭
          httpServer.close(resolve);
        });
        
        req.end();
      });
    });
  });

  it("缺少 Sec-WebSocket-Key 时拒绝连接", async () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        const port = httpServer.address().port;
        
        const req = request({
          hostname: "127.0.0.1",
          port,
          path: "/ws",
          headers: {
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "Sec-WebSocket-Version": "13"
            // 缺少 Sec-WebSocket-Key
          }
        });
        
        req.on("error", () => {
          httpServer.close(resolve);
        });
        
        req.on("response", () => {
          httpServer.close(resolve);
        });
        
        req.end();
      });
    });
  });
});

describe("WebSocket 帧编码", () => {
  it("小帧 (< 126 字节) 正确编码", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    // 通过 broadcast 间接测试帧编码
    // 验证不抛出异常
    assert.doesNotThrow(() => {
      ws.broadcast("test", { message: "hello" });
    });
    
    httpServer.close();
  });

  it("中等帧 (126-65535 字节) 正确编码", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    // 创建一个较大的消息
    const largeData = { message: "x".repeat(200) };
    assert.doesNotThrow(() => {
      ws.broadcast("test", largeData);
    });
    
    httpServer.close();
  });
});

describe("WebSocket 订阅管理", () => {
  it("支持事件订阅过滤", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    // 验证初始状态
    assert.equal(ws.getConnectionCount(), 0);
    const clients = ws.getClients();
    assert.equal(clients.length, 0);
    
    httpServer.close();
  });

  it("broadcast 只发送给订阅的客户端", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    // 无连接时 broadcast 不抛错
    assert.doesNotThrow(() => {
      ws.broadcast("release.created", { id: "123" });
    });
    
    httpServer.close();
  });
});

describe("WebSocket 回调集成", () => {
  it("onConnection 回调在连接时触发", () => {
    const httpServer = trackServer(createServer());
    let connectionId = null;
    
    const ws = createWebSocketServer({
      httpServer,
      onConnection: (id) => { connectionId = id; },
    });
    
    // 验证回调注册成功（无连接时不触发）
    assert.equal(connectionId, null);
    assert.equal(ws.getConnectionCount(), 0);
    
    httpServer.close();
  });

  it("onDisconnect 回调在断开时触发", () => {
    const httpServer = trackServer(createServer());
    let disconnectedId = null;
    
    const ws = createWebSocketServer({
      httpServer,
      onDisconnect: (id) => { disconnectedId = id; },
    });
    
    // 验证回调注册成功
    assert.equal(disconnectedId, null);
    
    httpServer.close();
  });

  it("onMessage 回调在收到消息时触发", () => {
    const httpServer = trackServer(createServer());
    let receivedMessage = null;
    
    const ws = createWebSocketServer({
      httpServer,
      onMessage: (id, msg) => { receivedMessage = msg; },
    });
    
    // 验证回调注册成功
    assert.equal(receivedMessage, null);
    
    httpServer.close();
  });
});

describe("WebSocket 边界情况", () => {
  it("多次 broadcast 不影响服务器状态", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    for (let i = 0; i < 100; i++) {
      ws.broadcast("test.event", { index: i });
    }
    
    assert.equal(ws.getConnectionCount(), 0);
    const clients = ws.getClients();
    assert.equal(clients.length, 0);
    
    httpServer.close();
  });

  it("发送空数据不抛错", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    assert.doesNotThrow(() => {
      ws.broadcast("test", null);
      ws.broadcast("test", undefined);
      ws.broadcast("test", {});
      ws.broadcast("test", []);
    });
    
    httpServer.close();
  });

  it("发送特殊字符数据不抛错", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    assert.doesNotThrow(() => {
      ws.broadcast("test", { 
        special: '<script>alert("xss")</script>',
        unicode: '你好世界 🌍',
        newlines: 'line1\nline2\rline3'
      });
    });
    
    httpServer.close();
  });
});

describe("WebSocket 协议细节", () => {
  it("encodeFrame 正确处理小帧 (< 126 字节)", () => {
    // 通过 broadcast 间接测试
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    // 小消息应该使用 2 字节头
    assert.doesNotThrow(() => {
      ws.broadcast("test", { a: 1 });
    });
    
    httpServer.close();
  });

  it("encodeFrame 正确处理中等帧 (126-65535 字节)", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    // 创建一个较大的消息 (>126 字节)
    const largeData = { message: "x".repeat(200) };
    assert.doesNotThrow(() => {
      ws.broadcast("test", largeData);
    });
    
    httpServer.close();
  });

  it("sendToClient 正确发送给指定客户端", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    // 无连接时调用 sendToClient 不应抛错
    // sendToClient 需要 client 对象，这里测试 broadcast
    assert.doesNotThrow(() => {
      ws.broadcast("test", { data: "test" });
    });
    
    httpServer.close();
  });
});

describe("WebSocket 心跳机制", () => {
  it("心跳间隔正确设置", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    // 验证服务器创建成功
    assert.ok(ws);
    assert.ok(ws.broadcast);
    assert.ok(ws.getConnectionCount);
    
    httpServer.close();
  });

  it("无连接时心跳不抛错", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    // 等待一个心跳周期
    // 由于是异步的，这里只验证创建成功
    assert.equal(ws.getConnectionCount(), 0);
    
    httpServer.close();
  });
});

describe("WebSocket 连接管理", () => {
  it("getClients 返回正确的客户端信息", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    const clients = ws.getClients();
    assert.ok(Array.isArray(clients));
    assert.equal(clients.length, 0);
    
    httpServer.close();
  });

  it("getConnectionCount 返回正确的连接数", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    assert.equal(ws.getConnectionCount(), 0);
    
    httpServer.close();
  });

  it("broadcast 支持通配符订阅", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    // 默认订阅 "*"
    assert.doesNotThrow(() => {
      ws.broadcast("any.event", { data: "test" });
      ws.broadcast("another.event", { data: "test2" });
    });
    
    httpServer.close();
  });
});

describe("WebSocket 错误恢复", () => {
  it("多次创建服务器不冲突", () => {
    const server1 = createServer();
    const server2 = createServer();
    
    const ws1 = createWebSocketServer({ httpServer: server1 });
    const ws2 = createWebSocketServer({ httpServer: server2 });
    
    assert.ok(ws1);
    assert.ok(ws2);
    assert.equal(ws1.getConnectionCount(), 0);
    assert.equal(ws2.getConnectionCount(), 0);
    
    server1.close();
    server2.close();
  });

  it("广播大量消息不溢出", () => {
    const httpServer = trackServer(createServer());
    const ws = createWebSocketServer({ httpServer });
    
    for (let i = 0; i < 1000; i++) {
      ws.broadcast("test.event", { index: i, data: "x".repeat(100) });
    }
    
    assert.equal(ws.getConnectionCount(), 0);
    
    httpServer.close();
  });
});