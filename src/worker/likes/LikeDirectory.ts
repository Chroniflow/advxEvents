interface CountRow {
  [key: string]: SqlStorageValue;
  count: number;
}

interface HotRow {
  [key: string]: SqlStorageValue;
  story_id: string;
  count: number;
}

export class LikeDirectory {
  constructor(private readonly state: DurableObjectState) {
    this.state.blockConcurrencyWhile(async () => {
      this.state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS likes (
          story_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (story_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS likes_by_story ON likes(story_id);
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/hottest" && request.method === "GET") {
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
      const rows = Array.from(
        this.state.storage.sql.exec<HotRow>(
          `SELECT story_id, COUNT(*) AS count
           FROM likes GROUP BY story_id ORDER BY count DESC, story_id ASC LIMIT ?`,
          limit,
        ),
      );
      return Response.json(rows.map((row) => ({ storyId: row.story_id, count: row.count })));
    }

    const match = url.pathname.match(/^\/stories\/([^/]+)$/);
    if (!match) return Response.json({ error: "Not found" }, { status: 404 });
    const storyId = decodeURIComponent(match[1]);
    const body = request.method === "GET" ? null : await request.json<{ userId?: string }>();
    const userId = body?.userId ?? url.searchParams.get("userId");

    if (request.method === "PUT" && userId) {
      this.state.storage.sql.exec(
        "INSERT OR IGNORE INTO likes (story_id, user_id, created_at) VALUES (?, ?, ?)",
        storyId,
        userId,
        new Date().toISOString(),
      );
    } else if (request.method === "DELETE" && userId) {
      this.state.storage.sql.exec(
        "DELETE FROM likes WHERE story_id = ? AND user_id = ?",
        storyId,
        userId,
      );
    } else if (request.method !== "GET") {
      return Response.json({ error: "User ID required" }, { status: 400 });
    }

    const countRow = Array.from(
      this.state.storage.sql.exec<CountRow>(
        "SELECT COUNT(*) AS count FROM likes WHERE story_id = ?",
        storyId,
      ),
    )[0];
    let liked = false;
    if (userId) {
      liked =
        Array.from(
          this.state.storage.sql.exec(
            "SELECT 1 FROM likes WHERE story_id = ? AND user_id = ? LIMIT 1",
            storyId,
            userId,
          ),
        ).length > 0;
    }
    return Response.json({ count: countRow?.count ?? 0, liked });
  }
}
