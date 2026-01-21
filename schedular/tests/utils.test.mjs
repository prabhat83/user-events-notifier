import { expect } from "chai";
import sinon from "sinon";
import { DateTime } from "luxon";
import { getTimezones, getTimezonesWith9AM } from "../utils.mjs";

describe("utils", () => {
  describe("getTimezones", () => {
    it("should return all supported timezones", () => {
      const timezones = getTimezones();

      expect(timezones).to.be.an("array");
      expect(timezones.length).to.be.greaterThan(0);
      expect(timezones).to.include("America/New_York");
      expect(timezones).to.include("Europe/London");
      expect(timezones).to.include("Asia/Tokyo");
    });

    it("should return the same array on multiple calls", () => {
      const firstCall = getTimezones();
      const secondCall = getTimezones();

      expect(firstCall).to.equal(secondCall);
    });
  });

  describe("getTimezonesWith9AM", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return timezones where current time is 9:00 AM", () => {
      // Freeze time to a specific UTC time
      // At 09:00 UTC, it's 9:00 AM in UTC timezone
      sinon
        .stub(DateTime, "utc")
        .returns(DateTime.fromISO("2026-01-21T09:00:00.000Z"));

      const timezones = getTimezonesWith9AM();

      expect(timezones).to.be.an("array");

      // Should include UTC and other timezones at 9:00 AM
      const utcTimezone = timezones.find(
        (tz) => tz.timezone === "Europe/London",
      );
      expect(utcTimezone).to.exist;
      expect(utcTimezone.timezone).to.equal("Europe/London");
      expect(utcTimezone.localTime).to.be.a("string");
      expect(utcTimezone.offset).to.be.a("string");
    });

    it("should return empty array if no timezones have 9:00 AM at current moment", () => {
      // Freeze time to 9:30 UTC - no timezone should have exactly 9:00 AM
      sinon
        .stub(DateTime, "utc")
        .returns(DateTime.fromISO("2026-01-21T09:30:00.000Z"));

      const timezones = getTimezonesWith9AM();

      expect(timezones).to.be.an("array");
      expect(timezones.length).to.equal(0);
    });

    it("should include multiple timezones with same offset", () => {
      // At 14:00 UTC, it's 9:00 AM in America/New_York (EST/UTC-5)
      sinon
        .stub(DateTime, "utc")
        .returns(DateTime.fromISO("2026-01-21T14:00:00.000Z"));

      const timezones = getTimezonesWith9AM();

      expect(timezones).to.be.an("array");
      expect(timezones.length).to.be.greaterThan(0);

      // Should include America/New_York and other EST timezones
      const estTimezones = timezones.filter((tz) =>
        tz.timezone.includes("America/"),
      );
      expect(estTimezones.length).to.be.greaterThan(0);
    });

    it("should return timezone objects with correct structure", () => {
      sinon
        .stub(DateTime, "utc")
        .returns(DateTime.fromISO("2026-01-21T09:00:00.000Z"));

      const timezones = getTimezonesWith9AM();

      if (timezones.length > 0) {
        const firstTimezone = timezones[0];

        expect(firstTimezone).to.have.property("timezone");
        expect(firstTimezone).to.have.property("localTime");
        expect(firstTimezone).to.have.property("offset");

        expect(firstTimezone.timezone).to.be.a("string");
        expect(firstTimezone.localTime).to.be.a("string");
        expect(firstTimezone.offset).to.be.a("string");
      }
    });

    it("should handle different UTC times correctly", () => {
      // Test at midnight UTC (00:00)
      sinon
        .stub(DateTime, "utc")
        .returns(DateTime.fromISO("2026-01-21T00:00:00.000Z"));

      const midnightTimezones = getTimezonesWith9AM();

      expect(midnightTimezones).to.be.an("array");

      // At 00:00 UTC, Pacific timezones (UTC-8/-9) should have 4:00 PM previous day
      // and Atlantic timezones around UTC-3 to UTC-5 should have evening times
      // So timezones around UTC+9 should have 9:00 AM
      const asiaTimezones = midnightTimezones.filter((tz) =>
        tz.timezone.includes("Asia/"),
      );

      // There should be some Asian timezones at 9:00 AM
      expect(asiaTimezones.length).to.be.greaterThan(0);
    });

    it("should only return timezones with exact 9:00 AM (not 9:01 or 8:59)", () => {
      sinon
        .stub(DateTime, "utc")
        .returns(DateTime.fromISO("2026-01-21T09:00:00.000Z"));

      const timezones = getTimezonesWith9AM();

      // All returned timezones should have exactly 9:00 AM
      timezones.forEach((tz) => {
        const localTime = DateTime.fromISO(tz.localTime).setZone(tz.timezone);
        expect(localTime.hour).to.equal(9);
        expect(localTime.minute).to.equal(0);
      });
    });
  });
});
