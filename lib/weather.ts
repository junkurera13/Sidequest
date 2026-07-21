// Best-effort current weather lookup via Open-Meteo. No API key required,
// free tier is generous (10k req/day). The agent uses the resulting short
// phrase silently in the quest prompt — never quoted verbatim, just as
// shaping context.

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "clear",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "foggy",
  48: "foggy",
  51: "drizzling",
  53: "drizzling",
  55: "drizzling",
  56: "freezing drizzle",
  57: "freezing drizzle",
  61: "light rain",
  63: "raining",
  65: "heavy rain",
  66: "freezing rain",
  67: "freezing rain",
  71: "light snow",
  73: "snowing",
  75: "heavy snow",
  77: "snow grains",
  80: "rain showers",
  81: "rain showers",
  82: "heavy rain showers",
  85: "snow showers",
  86: "heavy snow showers",
  95: "thunderstorms",
  96: "thunderstorms with hail",
  99: "thunderstorms with hail",
};

export function describeWmo(code: number | undefined): string | undefined {
  if (typeof code !== "number") return undefined;
  return WMO_DESCRIPTIONS[code];
}

export type CurrentWeather = {
  temperatureC: number;
  description: string;
  isDay: boolean;
};

export async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
): Promise<CurrentWeather | undefined> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&current=temperature_2m,weather_code,is_day` +
    `&temperature_unit=celsius`;

  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        is_day?: number;
      };
    };
    const temp = data.current?.temperature_2m;
    const code = data.current?.weather_code;
    const description = describeWmo(code);
    if (typeof temp !== "number" || !description) return undefined;
    return {
      temperatureC: Math.round(temp),
      description,
      isDay: data.current?.is_day === 1,
    };
  } catch {
    return undefined;
  }
}

// Short phrase suitable for slotting into the agent's local-context line.
// Example outputs: "4°C and raining", "23°C and clear".
export function formatWeather(weather: CurrentWeather): string {
  return `${weather.temperatureC}°C and ${weather.description}`;
}
