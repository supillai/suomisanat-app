import { describe, expect, it, vi } from "vitest";
import type { ProgressMap } from "../../types";
import {
  buildPushSyncBatchArgs,
  createBackgroundSyncRequests,
  mergeProgressMaps,
  normalizePullUserSyncStateResponse,
  normalizePushUserSyncBatchResponse,
  progressMapsEqual,
  toProgressMapFromRows,
  toProgressUpserts,
  toProgressUpsertsForWordIds,
  toSettingsUpsert
} from "./sync.utils";

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

    expect(
      toProgressUpsertsForWordIds(
        "user-1",
        {
          2: {
            seen: 1,
            correct: 1,
            wrong: 0,
            known: false,
            needsPractice: false,
            lastReviewed: "2026-03-15",
            updatedAt: "2026-03-15T11:00:00.000Z"
          },
          5: {
            seen: 4,
            correct: 3,
            wrong: 1,
            known: true,
            needsPractice: false,
            lastReviewed: "2026-03-15",
            updatedAt: "2026-03-15T11:10:00.000Z"
          }
        },
        new Set([5])
      )
    ).toEqual([
      {
        user_id: "user-1",
        word_id: 5,
        seen: 4,
        correct: 3,
        wrong: 1,
        known: true,
        needs_practice: false,
        last_reviewed: "2026-03-15",
        updated_at: "2026-03-15T11:10:00.000Z"
      }
    ]);

    expect(toSettingsUpsert("user-1", 12.2)).toEqual({
      user_id: "user-1",
      daily_goal: 12,
      updated_at: "2026-03-15T11:30:00.000Z"
    });

    vi.useRealTimers();
  });

  it("normalizes RPC payloads and responses", () => {
    expect(
      buildPushSyncBatchArgs(
        [{
          user_id: "user-1",
          word_id: 2,
          seen: 1,
          correct: 1,
          wrong: 0,
          known: false,
          needs_practice: false,
          last_reviewed: "2026-03-15",
          updated_at: "2026-03-15T11:00:00.000Z"
        }],
        {
          user_id: "user-1",
          daily_goal: 12,
          updated_at: "2026-03-15T11:30:00.000Z"
        },
        [5, 1]
      )
    ).toEqual({
      progress_rows: [expect.objectContaining({ word_id: 2 })],
      settings_row: expect.objectContaining({ daily_goal: 12 }),
      deleted_word_ids: [1, 5]
    });

    expect(
      normalizePullUserSyncStateResponse({
        settings: { daily_goal: 12, updated_at: "2026-03-15T11:30:00.000Z" },
        progress: [{ word_id: 2 }]
      })
    ).toEqual({
      settings: { daily_goal: 12, updated_at: "2026-03-15T11:30:00.000Z" },
      progress: [{ word_id: 2 }]
    });

    expect(normalizePushUserSyncBatchResponse({ progress_stale_count: 2, synced_at: "2026-03-15T11:30:00.000Z" })).toEqual({
      progress_accepted_count: 0,
      progress_stale_count: 2,
      settings_applied: false,
      settings_stale: false,
      deleted_count: 0,
      synced_at: "2026-03-15T11:30:00.000Z"
    });
  });

  it("creates keepalive background RPC sync requests in safe chunks", () => {
    const progressRows = [];

    for (let wordId = 1; wordId <= 205; wordId += 1) {
      progressRows.push({
        user_id: "user-1",
        word_id: wordId,
        seen: wordId,
        correct: wordId,
        wrong: 0,
        known: wordId % 2 === 0,
        needs_practice: wordId % 2 !== 0,
        last_reviewed: "2026-03-15",
        updated_at: "2026-03-15T11:30:00.000Z"
      });
    }

    const requests = createBackgroundSyncRequests({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "public-key",
      accessToken: "token-123",
      progressRows,
      settingsRow: {
        user_id: "user-1",
        daily_goal: 12,
        updated_at: "2026-03-15T11:30:00.000Z"
      }
    });

    expect(requests).toHaveLength(3);
    expect(requests[0]).toMatchObject({
      url: "https://example.supabase.co/rest/v1/rpc/push_user_sync_batch",
      init: expect.objectContaining({
        method: "POST",
        keepalive: true
      })
    });
    expect(requests[1]?.url).toBe("https://example.supabase.co/rest/v1/rpc/push_user_sync_batch");
    expect(requests[2]?.url).toBe("https://example.supabase.co/rest/v1/rpc/push_user_sync_batch");
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual(
      expect.objectContaining({
        settings_row: expect.objectContaining({ daily_goal: 12 }),
        deleted_word_ids: []
      })
    );
    expect(JSON.parse(String(requests[0]?.init.body)).progress_rows).toHaveLength(100);
    expect(JSON.parse(String(requests[1]?.init.body)).progress_rows).toHaveLength(100);
    expect(JSON.parse(String(requests[2]?.init.body)).progress_rows).toHaveLength(5);
    expect(JSON.parse(String(requests[1]?.init.body)).settings_row).toBeNull();
    expect(requests[1]?.init.headers).toMatchObject({
      apikey: "public-key",
      Authorization: "Bearer token-123"
    });
  });
});
