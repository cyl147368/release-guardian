import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, sanitizeObject, stripControlChars, truncate } from "../src/lib/sanitization.js";

describe("输入清理工具", () => {
  describe("escapeHtml", () => {
    it("转义 HTML 特殊字符", () => {
      assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it("转义 & 字符", () => {
      assert.equal(escapeHtml("a & b"), "a &amp; b");
    });

    it("转义单引号", () => {
      assert.equal(escapeHtml("it's"), "it&#x27;s");
    });

    it("不修改非字符串输入", () => {
      assert.equal(escapeHtml(123), 123);
      assert.equal(escapeHtml(null), null);
    });

    it("不修改安全字符串", () => {
      assert.equal(escapeHtml("hello world"), "hello world");
    });
  });

  describe("sanitizeObject", () => {
    it("清理嵌套对象中的字符串", () => {
      const input = { name: '<b>test</b>', nested: { value: 'a & b' } };
      const result = sanitizeObject(input);
      assert.equal(result.name, '&lt;b&gt;test&lt;/b&gt;');
      assert.equal(result.nested.value, 'a &amp; b');
    });

    it("清理数组中的字符串", () => {
      const result = sanitizeObject(['<script>', 'safe']);
      assert.equal(result[0], '&lt;script&gt;');
      assert.equal(result[1], 'safe');
    });

    it("处理 null 和 undefined", () => {
      assert.equal(sanitizeObject(null), null);
      assert.equal(sanitizeObject(undefined), undefined);
    });

    it("保留非字符串类型", () => {
      const result = sanitizeObject({ num: 42, bool: true });
      assert.equal(result.num, 42);
      assert.equal(result.bool, true);
    });
  });

  describe("stripControlChars", () => {
    it("移除控制字符", () => {
      assert.equal(stripControlChars("hello\x00world"), "helloworld");
      assert.equal(stripControlChars("test\x1Fstring"), "teststring");
    });

    it("保留正常字符和换行", () => {
      assert.equal(stripControlChars("hello\nworld"), "hello\nworld");
      assert.equal(stripControlChars("hello\tworld"), "hello\tworld");
    });

    it("不修改非字符串输入", () => {
      assert.equal(stripControlChars(123), 123);
    });
  });

  describe("truncate", () => {
    it("截断超长字符串", () => {
      const long = "a".repeat(20000);
      assert.equal(truncate(long, 100).length, 100);
    });

    it("不截断短字符串", () => {
      assert.equal(truncate("short", 100), "short");
    });

    it("使用默认长度", () => {
      const long = "a".repeat(15000);
      assert.equal(truncate(long).length, 10000);
    });

    it("不修改非字符串输入", () => {
      assert.equal(truncate(123, 10), 123);
    });
  });
});
