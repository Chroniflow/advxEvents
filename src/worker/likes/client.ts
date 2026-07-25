import type { Env } from "../env";

export function likeDirectory(env: Env): DurableObjectStub {
  return env.LIKES.get(env.LIKES.idFromName("global"));
}

