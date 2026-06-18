import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createWebSocketServer } from "../src/lib/websocket.js";
import { randomUUID } from "node:crypto";

describe("WebSocket 实时推送", () => {
  it("创建 WebSocket 服务器并返回控制方法", () => {
    const httpServer = createServer();
    const ws = createWebSocketServer({ httpServer });
    
    assert.ok(ws.broadcast);
    assert.ok(ws.sendToClient);
    assert.ok(ws.getConnectionCount);
    assert.ok(ws.getClients);
    assert.equal(ws.getConnectionCount(), 0);
    
    httpServer.close();
  });

  it("getClients 返回空数组当无连接时", () => {
    const httpServer = createServer();
    const ws = createWebSocketServer({ httpServer });
    
    const clients = ws.getClients();
    assert.ok(Array.isArray(clients));
    assert.equal(clients.length, 0);
    
    httpServer.close();
  });

  it("broadcast 不抛出错误当无连接时", () => {
    const httpServer = createServer();
    const ws = createWebSocketServer({ httpServer });
    
    assert.doesNotThrow(() => {
      ws.broadcast("test.event", { data: "test" });
    });
    
    httpServer.close();
  });

  it("支持自定义回调函数", () => {
    const httpServer = createServer();
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
    const httpServer = createServer();
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
    const httpServer = createServer();
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
    const httpServer = createServer();
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
