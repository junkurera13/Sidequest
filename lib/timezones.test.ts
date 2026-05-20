import { describe, expect, it } from "vitest";

import { buildLocalContext, timezoneFromPhone } from "./timezones";

describe("timezoneFromPhone", () => {
  it("ignores provider identifiers that are not phone numbers", () => {
    expect(timezoneFromPhone("shared")).toBeUndefined();
    expect(buildLocalContext({ phone: "shared" })).toBeUndefined();
  });

  it("resolves E.164 phone numbers when possible", () => {
    expect(timezoneFromPhone("+821012345678")).toBe("Asia/Seoul");
  });
});
