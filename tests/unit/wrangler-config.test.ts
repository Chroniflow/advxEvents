import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface WranglerConfig {
  keep_vars?: boolean;
  vars?: Record<string, unknown>;
  assets?: {
    binding?: string;
    directory?: string;
    not_found_handling?: string;
    run_worker_first?: string[];
  };
  kv_namespaces?: Array<{ binding: string; id?: string; preview_id?: string }>;
  r2_buckets?: Array<{
    binding: string;
    bucket_name?: string;
    preview_bucket_name?: string;
  }>;
  durable_objects?: {
    bindings?: Array<{ name: string; class_name: string }>;
  };
}

const config = JSON.parse(
  readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"),
) as WranglerConfig;

describe("开源 Wrangler 配置", () => {
  it("只声明稳定资源绑定，不包含部署实例标识", () => {
    expect(config.kv_namespaces).toEqual([{ binding: "CONTENT" }]);
    expect(config.r2_buckets).toEqual([{ binding: "MEDIA" }]);
    expect(config.durable_objects?.bindings).toContainEqual({
      name: "LIKES",
      class_name: "LikeDirectory",
    });
  });

  it("由 Dashboard 管理运行时变量", () => {
    expect(config.keep_vars).toBe(true);
    expect(config.vars).toBeUndefined();
  });

  it("为客户端路由启用 SPA 回退，同时优先运行 API Worker", () => {
    expect(config.assets).toEqual({
      binding: "ASSETS",
      directory: "./dist",
      not_found_handling: "single-page-application",
      run_worker_first: ["/api/*"],
    });
  });
});
