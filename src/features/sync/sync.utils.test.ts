import { describe, expect, it, vi } from "vitest";
import type { ProgressMap } from "../../types";
import { createBackgroundSyncRequests, mergeProgressMaps, progressMapsEqual, toProgressMapFromRows, toProgressUpserts, toSettingsUpsert } from "./sync.utils";

describe("sync.utils", () => {
  it("merges local and server progress while preferring the freshest state flags", () => {
    const localMap: ProgressMap = {
      1: {
        seen: 2,
        correct: 1,
        wrong: 1,
        known: false,
        needsPractice: true,
        lastReviewed: "2026-03-10",
        updatedAt: "2026-03-10T12:00:00.000Z"
      }
    };
    const serverMap: ProgressMap = {
      1: {
        seen: 5,
        correct: 5,
        wrong: 0,
        known: true,
        needsPractice: false,
        lastReviewed: "2026-03-12",
        updatedAt: "2026-03-12T12:00:00.000Z"
      }
    };

    expect(mergeProgressMaps(localMap, serverMap)).toEqual({
      1: {
        seen: 5,
        correct: 5,
        wrong: 1,
        known: true,
        needsPractice: false,
        lastReviewed: "2026-03-12",
        updatedAt: "2026-03-12T12:00:00.000Z"
      }
    });
  });

  it("compares progress maps without considering updatedAt noise", () => {
    expect(
      progressMapsEqual(
        {
          1: {
            seen: 1,
            correct: 1,
            wrong: 0,
            known: false,
            needsPractice: false,
            lastReviewed: "2026-03-12",
            updatedAt: "2026-03-12T10:00:00.000Z"
          }
        },
        {
          1: {
            seen: 1,
            correct: 1,
            wrong: 0,
            known: false,
            needsPractice: false,
            lastReviewed: "2026-03-12",
            updatedAt: "2026-03-12T12:00:00.000Z"
          }
        }
      )
    ).toBe(true);
  });

  it("normalizes rows coming from the server", () => {
    expect(
      toProgressMapFromRows([
        {
          word_id: 7,
          seen: 4,
          correct: 3,
          wrong: 1,
          known: true,
          needs_practice: true,
          last_reviewed: "2026-03-14",
          updated_at: "2026-03-14T12:00:00.000Z"
        }
      ])
    ).toEqual({
      7: {
        seen: 4,
        correct: 3,
        wrong: 1,
        known: true,
        needsPractice: false,
        lastReviewed: "2026-03-14",
        updatedAt: "2026-03-14T12:00:00.000Z"
      }
    });
  });

  it("creates upsert rows with normalized flags and timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T11:30:00.000Z"));

    expect(
      toProgressUpserts("user-1", {
        3: {
          seen: 2,
          correct: 2,
          wrong: 0,
          known: true,
          needsPractice: true,
          lastReviewed: "2026-03-15",
          updatedAt: null
        }
      })
    ).toEqual([
      {
        user_id: "user-1",
        word_id: 3,
        seen: 2,
        correct: 2,
        wrong: 0,
        known: true,
        needs_practice: false,
        last_reviewed: "2026-03-15",
        updated_at: "2026-03-15T11:30:00.000Z"
      }
    ]);

    expect(toSettingsUpsert("user-1", 12.2)).toEqual({
      user_id: "user-1",
      daily_goal: 12,
      updated_at: "2026-03-15T11:30:00.000Z"
    });

    vi.useRealTimers();
  });

  it("creates keepalive background sync requests in safe chunks", () => {
    const progressMap: ProgressMap = {};

    for (let wordId = 1; wordId <= 205; wordId += 1) {
      progressMap[wordId] = {
        seen: wordId,
        correct: wordId,
        wrong: 0,
        known: wordId % 2 === 0,
        needsPractice: wordId % 2 !== 0,
        lastReviewed: "2026-03-15",
        updatedAt: "2026-03-15T11:30:00.000Z"
      };
    }

    const requests = createBackgroundSyncRequests({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "public-key",
      accessToken: "token-123",
      userId: "user-1",
      map: progressMap,
      goal: 12
    });

    expect(requests).toHaveLength(4);
    expect(requests[0]).toMatchObject({
      url: "https://example.supabase.co/rest/v1/user_settings?on_conflict=user_id",
      init: expect.objectContaining({
        method: "POST",
        keepalive: true
      })
    });
    expect(requests[1]?.url).toBe("https://example.supabase.co/rest/v1/user_progress?on_conflict=user_id,word_id");
    expect(requests[2]?.url).toBe("https://example.supabase.co/rest/v1/user_progress?on_conflict=user_id,word_id");
    expect(requests[3]?.url).toBe("https://example.supabase.co/rest/v1/user_progress?on_conflict=user_id,word_id");
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual([
      expect.objectContaining({ user_id: "user-1", daily_goal: 12 })
    ]);
    expect(JSON.parse(String(requests[1]?.init.body))).toHaveLength(100);
    expect(JSON.parse(String(requests[2]?.init.body))).toHaveLength(100);
    expect(JSON.parse(String(requests[3]?.init.body))).toHaveLength(5);
    expect(requests[1]?.init.headers).toMatchObject({
      apikey: "public-key",
      Authorization: "Bearer token-123",
      Prefer: "resolution=merge-duplicates,return=minimal"
    });
  });
});
