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
