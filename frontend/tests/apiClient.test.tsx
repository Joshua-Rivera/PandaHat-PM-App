import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch, ApiError } from "@/lib/api/client";

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch error mapping", () => {
  it("maps Pydantic 422 errors to per-field messages", async () => {
    const detail = [{ loc: ["body", "title"], msg: "String should have at least 1 character" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail }), { status: 422 })));
    const error = (await apiFetch("/x").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.fieldErrors).toEqual({ title: "String should have at least 1 character" });
  });

  it("keeps the field hint from domain errors", async () => {
    const body = { detail: "A project with this name already exists", field: "name" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 409 })));
    const error = (await apiFetch("/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(409);
    expect(error.fieldErrors).toEqual({ name: "A project with this name already exists" });
  });

  it("turns a network failure into a readable message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = (await apiFetch("/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/Can't reach the PandaHat server/);
  });
});
