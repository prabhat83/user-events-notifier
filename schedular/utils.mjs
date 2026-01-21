import { DateTime } from "luxon";

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export const getTimezones = () => {
  return TIMEZONES;
};

export const getTimezonesWith9AM = () => {
  const now = DateTime.utc();
  const timezonesWith9AM = [];

  for (const timezone of TIMEZONES) {
    const localTime = now.setZone(timezone);

    // Check if current time in this timezone is 9:00 AM (hour = 9, minute = 0)
    if (localTime.hour === 9 && localTime.minute === 0) {
      timezonesWith9AM.push({
        timezone,
        localTime: localTime.toISO(),
        offset: localTime.offsetNameShort,
      });
    }
  }

  return timezonesWith9AM;
};
