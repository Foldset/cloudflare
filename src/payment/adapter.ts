import type { RequestAdapter } from "@foldset/core";
import { Context } from "hono";

export class HonoAdapter implements RequestAdapter {
  constructor(private c: Context) {}

  getIpAddress(): string | null {
    const header =
      this.c.req.header("cf-connecting-ip") ||
      this.c.req.header("x-forwarded-for");
    return header?.split(",")[0]?.trim() || null;
  }

  getHeader(name: string): string | undefined {
    return this.c.req.header(name);
  }

  getMethod(): string {
    return this.c.req.method;
  }

  getPath(): string {
    return this.c.req.path;
  }

  getUrl(): string {
    return this.c.req.url;
  }

  getAcceptHeader(): string {
    return this.c.req.header("Accept") || "";
  }

  getUserAgent(): string {
    return this.c.req.header("User-Agent") || "";
  }

  getQueryParams(): Record<string, string | string[]> {
    const query = this.c.req.query();
    const result: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(query)) {
      result[key] = value;
    }
    return result;
  }

  getQueryParam(name: string): string | string[] | undefined {
    return this.c.req.query(name);
  }

  async getBody(): Promise<unknown> {
    try {
      return await this.c.req.json();
    } catch {
      return undefined;
    }
  }
}
