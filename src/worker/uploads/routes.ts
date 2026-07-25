import { Hono } from "hono";

import type { AuthVariables } from "../auth/middleware";
import { requireUser } from "../auth/middleware";
import type { Env } from "../env";
import { AssetRepository } from "./assets";
import { inspectImage, MAX_IMAGE_BYTES } from "./validate";

export function uploadRoutes() {
  const routes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
  routes.use("*", requireUser());

  routes.post("/", async (context) => {
    const form = await context.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return context.json({ error: "Image file required" }, 400);
    if (file.size > MAX_IMAGE_BYTES) return context.json({ error: "Image exceeds size limit" }, 400);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const inspection = inspectImage(bytes, file.type);
      const assetId = crypto.randomUUID();
      const objectKey = `stories/unassigned/${assetId}/original`;
      await context.env.MEDIA.put(objectKey, bytes, {
        httpMetadata: { contentType: inspection.contentType },
      });
      const asset = {
        assetId,
        ownerGithubId: context.get("user").githubId,
        objectKey,
        ...inspection,
        originalName: file.name.slice(0, 255),
        public: false,
        createdAt: new Date().toISOString(),
      };
      await new AssetRepository(context.env.CONTENT).save(asset);
      return context.json(asset, 201);
    } catch (error) {
      return context.json({ error: (error as Error).message }, 400);
    }
  });

  routes.delete("/:assetId", async (context) => {
    const assets = new AssetRepository(context.env.CONTENT);
    try {
      const asset = await assets.getOwned(
        context.req.param("assetId"),
        context.get("user").githubId,
      );
      if (!asset) return context.json({ error: "Asset not found" }, 404);
      if (asset.public) return context.json({ error: "Published asset cannot be deleted" }, 409);
      await Promise.all([
        context.env.MEDIA.delete(asset.objectKey),
        assets.delete(asset.assetId),
      ]);
      return context.body(null, 204);
    } catch (error) {
      return context.json({ error: (error as Error).message }, 403);
    }
  });

  return routes;
}

export function mediaRoutes() {
  const routes = new Hono<{ Bindings: Env }>();
  routes.get("/:assetId", async (context) => {
    const asset = await new AssetRepository(context.env.CONTENT).get(
      context.req.param("assetId"),
    );
    if (!asset?.public) return context.json({ error: "Asset not found" }, 404);
    const object = await context.env.MEDIA.get(asset.objectKey);
    if (!object) return context.json({ error: "Asset not found" }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(object.body, { headers });
  });
  return routes;
}
