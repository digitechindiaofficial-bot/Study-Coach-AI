import assert from "node:assert/strict";
import test from "node:test";
import { hasActiveProAccess, withEffectivePlan } from "./plan-access.ts";

const now = new Date("2026-09-04T12:00:00.000Z");

test("only a Pro profile with a future expiry has Pro access", () => {
  assert.equal(
    hasActiveProAccess(
      { planType: "pro", planExpiry: "2026-10-04T12:00:00.000Z" },
      now,
    ),
    true,
  );
  assert.equal(
    hasActiveProAccess(
      { planType: "free", planExpiry: "2026-10-04T12:00:00.000Z" },
      now,
    ),
    false,
  );
  assert.equal(
    hasActiveProAccess(
      { planType: "pro", planExpiry: "2026-08-04T12:00:00.000Z" },
      now,
    ),
    false,
  );
  assert.equal(hasActiveProAccess({ planType: "pro", planExpiry: null }, now), false);
  assert.equal(
    hasActiveProAccess({ planType: "pro", planExpiry: "not-a-date" }, now),
    false,
  );
});

test("expired Pro profiles are presented to clients as Free", () => {
  const profile = withEffectivePlan({
    id: "profile-id",
    planType: "pro",
    planExpiry: "2020-01-01T00:00:00.000Z",
  });

  assert.equal(profile.planType, "free");
  assert.equal(profile.id, "profile-id");
});