import { createApp } from "./app";
import type { Env } from "./env";
import { garbageCollection } from "./gc/service";

const app = createApp();

export default {
  fetch: app.fetch,
  scheduled(_controller, env, context) {
    context.waitUntil(garbageCollection(env).run());
  },
} satisfies ExportedHandler<Env>;

export { LikeDirectory } from "./likes/LikeDirectory";
