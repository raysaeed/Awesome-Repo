// Top 5 urban agglomerations by population, per UN World Urbanization Prospects 2025.
const CITIES = [
  { name: "Jakarta", country: "Indonesia", population: 41.9, lat: -6.2088, lon: 106.8456 },
  { name: "Dhaka", country: "Bangladesh", population: 36.6, lat: 23.8103, lon: 90.4125 },
  { name: "Tokyo", country: "Japan", population: 33.4, lat: 35.6762, lon: 139.6503 },
  { name: "New Delhi", country: "India", population: 30.2, lat: 28.6139, lon: 77.209 },
  { name: "Shanghai", country: "China", population: 29.6, lat: 31.2304, lon: 121.4737 },
];

// WMO weather interpretation codes -> [description, day icon, night icon]
const WEATHER_CODES = {
  0: ["Clear sky", "☀️", "🌙"],
  1: ["Mainly clear", "🌤️", "🌙"],
  2: ["Partly cloudy", "⛅", "☁️"],
  3: ["Overcast", "☁️", "☁️"],
  45: ["Fog", "🌫️", "🌫️"],
  48: ["Rime fog", "🌫️", "🌫️"],
  51: ["Light drizzle", "🌦️", "🌧️"],
  53: ["Drizzle", "🌦️", "🌧️"],
  55: ["Heavy drizzle", "🌧️", "🌧️"],
  56: ["Freezing drizzle", "🌧️", "🌧️"],
  57: ["Freezing drizzle", "🌧️", "🌧️"],
  61: ["Light rain", "🌦️", "🌧️"],
  63: ["Rain", "🌧️", "🌧️"],
  65: ["Heavy rain", "🌧️", "🌧️"],
  66: ["Freezing rain", "🌧️", "🌧️"],
  67: ["Freezing rain", "🌧️", "🌧️"],
  71: ["Light snow", "🌨️", "🌨️"],
  73: ["Snow", "🌨️", "🌨️"],
  75: ["Heavy snow", "❄️", "❄️"],
  77: ["Snow grains", "🌨️", "🌨️"],
  80: ["Rain showers", "🌦️", "🌧️"],
  81: ["Rain showers", "🌧️", "🌧️"],
  82: ["Violent showers", "⛈️", "⛈️"],
  85: ["Snow showers", "🌨️", "🌨️"],
  86: ["Snow showers", "❄️", "❄️"],
  95: ["Thunderstorm", "⛈️", "⛈️"],
  96: ["Thunderstorm, hail", "⛈️", "⛈️"],
  99: ["Thunderstorm, hail", "⛈️", "⛈️"],
};

const API = "https://api.open-meteo.com/v1/forecast";
const REFRESH_MS = 10 * 60 * 1000;

let unit = loadUnit();
let clockTimer;

function loadUnit() {
  try {
    return localStorage.getItem("unit") === "fahrenheit" ? "fahrenheit" : "celsius";
  } catch {
    return "celsius";
  }
}

function saveUnit(value) {
  try {
    localStorage.setItem("unit", value);
  } catch {
    // Storage unavailable; preference just won't persist.
  }
}

function describe(code, isDay) {
  const [text, day, night] = WEATHER_CODES[code] || ["Unknown", "🌡️", "🌡️"];
  return { text, icon: isDay === 0 ? night : day };
}

function buildUrl() {
  const params = new URLSearchParams({
    latitude: CITIES.map((c) => c.lat).join(","),
    longitude: CITIES.map((c) => c.lon).join(","),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
    timezone: "auto",
    forecast_days: "5",
    temperature_unit: unit,
    wind_speed_unit: unit === "fahrenheit" ? "mph" : "kmh",
    precipitation_unit: unit === "fahrenheit" ? "inch" : "mm",
  });
  return `${API}?${params}`;
}

function compass(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// Open-Meteo returns local times like "2026-10-30T06:12" (no offset) when timezone=auto.
function hhmm(localIso) {
  return localIso.slice(11, 16);
}

function weekday(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

function localTime(timezone) {
  try {
    return new Date().toLocaleTimeString(undefined, { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function renderCard(city, rank, data) {
  const node = document.getElementById("card-tpl").content.cloneNode(true);
  const $ = (sel) => node.querySelector(sel);
  const cur = data.current;
  const u = data.current_units;
  const daily = data.daily;
  const deg = Math.round;
  const now = describe(cur.weather_code, cur.is_day);

  $(".rank").textContent = `#${rank}`;
  $(".city").textContent = city.name;
  $(".country").textContent = city.country;
  $(".icon").textContent = now.icon;
  $(".temp").textContent = `${deg(cur.temperature_2m)}°`;
  $(".cond").textContent = now.text;
  $(".feels").textContent = `Feels like ${deg(cur.apparent_temperature)}°`;
  $(".hilo").textContent = `${deg(daily.temperature_2m_max[0])}° / ${deg(daily.temperature_2m_min[0])}°`;
  $(".humidity").textContent = `${cur.relative_humidity_2m}%`;
  $(".wind").textContent = `${deg(cur.wind_speed_10m)} ${u.wind_speed_10m} ${compass(cur.wind_direction_10m)}`;
  $(".precip").textContent = `${cur.precipitation} ${u.precipitation}`;
  $(".sunrise").textContent = hhmm(daily.sunrise[0]);
  $(".sunset").textContent = hhmm(daily.sunset[0]);
  $(".pop").textContent = `${city.population}M people`;
  const local = $(".local");
  local.dataset.tz = data.timezone;
  local.textContent = localTime(data.timezone);

  const list = $(".forecast");
  daily.time.forEach((day, i) => {
    const li = document.createElement("li");
    const f = describe(daily.weather_code[i], 1);
    li.title = f.text;
    li.innerHTML = `<div class="d"></div><div class="i"></div><div class="t"><span class="hi"></span> <span class="lo"></span></div>`;
    li.querySelector(".d").textContent = i === 0 ? "Today" : weekday(day);
    li.querySelector(".i").textContent = f.icon;
    li.querySelector(".hi").textContent = `${deg(daily.temperature_2m_max[i])}°`;
    li.querySelector(".lo").textContent = `${deg(daily.temperature_2m_min[i])}°`;
    list.appendChild(li);
  });

  return node;
}

function renderError(city, rank) {
  const card = document.createElement("article");
  card.className = "card failed";
  card.innerHTML = `<span class="rank"></span><h2 class="city"></h2><p class="msg">Weather unavailable.</p>`;
  card.querySelector(".rank").textContent = `#${rank}`;
  card.querySelector(".city").textContent = city.name;
  return card;
}

function tickClocks() {
  document.querySelectorAll(".local[data-tz]").forEach((el) => {
    el.textContent = localTime(el.dataset.tz);
  });
}

async function load() {
  const status = document.getElementById("status");
  const grid = document.getElementById("cities");
  status.className = "status";
  status.textContent = "Loading weather…";

  try {
    const res = await fetch(buildUrl());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let results = await res.json();
    // A single location comes back as an object; multiple as an array.
    if (!Array.isArray(results)) results = [results];

    grid.replaceChildren(
      ...CITIES.map((city, i) =>
        results[i]?.current ? renderCard(city, i + 1, results[i]) : renderError(city, i + 1)
      )
    );
    status.textContent = "";
    document.getElementById("updated").textContent = `Last updated ${new Date().toLocaleTimeString()}`;
    clearInterval(clockTimer);
    clockTimer = setInterval(tickClocks, 30 * 1000);
  } catch (err) {
    status.className = "status error";
    status.textContent = `Couldn't load weather (${err.message}). Check your connection and try Refresh.`;
  }
}

function syncUnitButtons() {
  document.querySelectorAll(".units button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.unit === unit));
  });
}

document.querySelectorAll(".units button").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.unit === unit) return;
    unit = b.dataset.unit;
    saveUnit(unit);
    syncUnitButtons();
    load();
  });
});

document.getElementById("refresh").addEventListener("click", load);

syncUnitButtons();
load();
setInterval(load, REFRESH_MS);
