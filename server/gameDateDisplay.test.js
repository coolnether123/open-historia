import assert from "node:assert/strict";
import { test } from "node:test";
import { formatGameDate } from "../src/runtime/gameDate.js";

test("date-only game timestamps never shift to the previous local day", () => {
  assert.equal(formatGameDate("2016-01-01", "en-US"), "Jan 1, 2016");
  assert.equal(formatGameDate("2016-01-01T00:00:00.000Z", "en-US"), "Jan 1, 2016");
});

test("unparseable historical labels are preserved", () => {
  assert.equal(formatGameDate("1200 BCE", "en-US"), "1200 BCE");
});
