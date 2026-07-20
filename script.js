const DEV_MODE = false;

const SKIN_TONES = [
  { id: 'light',        color: '#F5CBA7' },
  { id: 'medium-light', color: '#E8B48F' },
  { id: 'medium',       color: '#C68B5F' },
  { id: 'medium-dark',  color: '#8B5A3C' },
  { id: 'dark',         color: '#5D3A22' }
];

const HAIR_STYLES = ['spiky', 'quiff', 'swept', 'messy', 'long', 'bob', 'bald'];

const HAIR_COLORS = [
  { id: 'black',       color: '#1C1C1C' },
  { id: 'dark-brown',  color: '#3E2723' },
  { id: 'brown',       color: '#6D4C41' },
  { id: 'light-brown', color: '#A1887F' },
  { id: 'grey',        color: '#9E9E9E' }
];

const OUTFIT_PALETTES = {
  blues: {
    name: 'Blues',
    hot:  { top: '#AED6F1', topDark: '#7FB3D3', bottom: '#7FB3D3', bottomDark: '#5B9EC9', shoes: '#C9A84C' },
    warm: { top: '#A9DFBF', topDark: '#82E0AA', bottom: '#82E0AA', bottomDark: '#58D68D', shoes: '#566573' },
    mild: { top: '#85C1E9', topDark: '#5DADE2', bottom: '#2980B9', bottomDark: '#1A5276', shoes: '#424949' },
    cool: { top: '#7D6608', topDark: '#9A7D0A', bottom: '#1A5276', bottomDark: '#154360', shoes: '#1C2833' },
    cold: { top: '#1C2833', topDark: '#2C3E50', bottom: '#1A5276', bottomDark: '#154360', shoes: '#17202A' }
  },
  warm: {
    name: 'Warm',
    hot:  { top: '#F5B7B1', topDark: '#EC7063', bottom: '#F0B27A', bottomDark: '#E67E22', shoes: '#7D6608' },
    warm: { top: '#F1948A', topDark: '#E74C3C', bottom: '#D68910', bottomDark: '#B7950B', shoes: '#5D4037' },
    mild: { top: '#F5B041', topDark: '#E67E22', bottom: '#8B4513', bottomDark: '#5D4037', shoes: '#3E2723' },
    cool: { top: '#873600', topDark: '#A04000', bottom: '#4A2C0A', bottomDark: '#3E2723', shoes: '#1C0E00' },
    cold: { top: '#4A2C0A', topDark: '#6E2C00', bottom: '#3E2723', bottomDark: '#1C0E00', shoes: '#0D0500' }
  },
  neutral: {
    name: 'Neutral',
    hot:  { top: '#D5DBDB', topDark: '#AEB6BF', bottom: '#B0B7C0', bottomDark: '#8090A0', shoes: '#2C3E50' },
    warm: { top: '#BDC3C7', topDark: '#95A5A6', bottom: '#7F8C8D', bottomDark: '#5D6D7E', shoes: '#212F3D' },
    mild: { top: '#909497', topDark: '#616A6B', bottom: '#34495E', bottomDark: '#2C3E50', shoes: '#1C2833' },
    cool: { top: '#2C3E50', topDark: '#34495E', bottom: '#212F3D', bottomDark: '#17202A', shoes: '#0B0F14' },
    cold: { top: '#17202A', topDark: '#212F3D', bottom: '#0B0F14', bottomDark: '#000000', shoes: '#000000' }
  }
};

let currentRules      = null;
let currentSkinTone   = SKIN_TONES[0];
let currentHairStyle  = 'spiky';
let currentHairColor  = HAIR_COLORS[1];
let currentPalette    = 'blues';
let forecastData      = [];
let selectedDayIndex  = 0;

async function init() {
  loadPreferences();
  setupSearch();
  setupSettings();
  buildAllSwatches();

  document.getElementById('app').classList.add('loading');

  try {
    currentRules = await loadRules();
    const coords = await getLocation();
    await loadWeatherForCoords(coords.lat, coords.lon);
  } catch (err) {
    showError(err.message);
  }
}

async function loadWeatherForCoords(lat, lon) {
  const [current, forecast] = await Promise.all([
    getWeather(lat, lon),
    getForecast(lat, lon)
  ]);

  forecastData = [buildTodayFromCurrent(current), ...forecast];
  selectedDayIndex = 0;
  renderForDay(0);
}

async function loadWeatherForCity(city) {
  const currentByCity = await getWeatherByCity(city);
  const forecast = await getForecastByCity(city);

  forecastData = [buildTodayFromCurrent(currentByCity), ...forecast];
  selectedDayIndex = 0;
  renderForDay(0);
}

function buildTodayFromCurrent(w) {
  return { ...w, dayName: 'Today', isToday: true };
}

async function loadRules() {
  const res = await fetch('rules.json');
  if (!res.ok) throw new Error("Couldn't load the rules file. Make sure rules.json is in the same folder.");
  return res.json();
}

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser doesn't support location. Try opening this in Chrome or Safari."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      ()  => reject(new Error("Location access was denied. Allow location in your browser settings and refresh the page."))
    );
  });
}

async function getWeather(lat, lon) {
  const url = `/.netlify/functions/weather?lat=${lat}&lon=${lon}`;
  return fetchCurrentWeather(url);
}

async function getWeatherByCity(city) {
  const url = `/.netlify/functions/weather?city=${encodeURIComponent(city)}`;
  return fetchCurrentWeather(url);
}

async function fetchCurrentWeather(url) {
  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 404) throw new Error("Couldn't find that city. Try checking the spelling.");
    throw new Error("Couldn't fetch the weather right now. Check your connection and try refreshing.");
  }

  const d = await res.json();
  const now = Math.floor(Date.now() / 1000);
  const isNight = (d.sys?.sunset && d.sys?.sunrise)
    ? (now > d.sys.sunset || now < d.sys.sunrise)
    : false;

  return parseWeather(d, isNight, d.coord?.lat, d.coord?.lon);
}

async function getForecast(lat, lon) {
  const url = `/.netlify/functions/weather?lat=${lat}&lon=${lon}&type=forecast`;
  return fetchForecast(url);
}

async function getForecastByCity(city) {
  const url = `/.netlify/functions/weather?city=${encodeURIComponent(city)}&type=forecast`;
  return fetchForecast(url);
}

async function fetchForecast(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't fetch the forecast right now.");

  const d = await res.json();
  return pickDailyForecasts(d.list, d.city);
}

function pickDailyForecasts(list, city) {
  const byDate = {};
  list.forEach(item => {
    const dt = new Date(item.dt * 1000);
    const dateKey = dt.toISOString().slice(0, 10);
    const hour    = dt.getHours();

    if (!byDate[dateKey] || Math.abs(hour - 12) < Math.abs(new Date(byDate[dateKey].dt * 1000).getHours() - 12)) {
      byDate[dateKey] = item;
    }
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return Object.entries(byDate)
    .filter(([key]) => key !== todayKey)
    .slice(0, 3)
    .map(([key, item]) => {
      const dt = new Date(item.dt * 1000);
      const parsed = parseWeather(item, false);
      parsed.city = city.name;
      parsed.dayName = dayNames[dt.getDay()];
      parsed.isToday = false;
      return parsed;
    });
}

function parseWeather(d, isNight, lat, lon) {
  const windKmh     = Math.round((d.wind?.speed || 0) * 3.6);
  const mainCond    = d.weather[0]?.main || '';
  const isRaining   = ['Rain', 'Drizzle', 'Thunderstorm'].includes(mainCond);
  const isClear     = mainCond === 'Clear';
  const isCloudy    = ['Clouds', 'Mist', 'Fog', 'Haze'].includes(mainCond);
  const isSnowing   = mainCond === 'Snow';
  const description = d.weather[0]?.description || '';

  return {
    temp:        Math.round(d.main.temp),
    feelsLike:   Math.round(d.main.feels_like),
    windKmh, isRaining, isClear, isCloudy, isSnowing, isNight,
    description,
    city: d.name || '',
    lat, lon
  };
}

function buildRecommendation(weather, rules) {
  const condition = rules.conditions.find(
    c => weather.temp >= c.tempMin && weather.temp <= c.tempMax
  );
  if (!condition) throw new Error("Temperature reading seems unusual. Try refreshing.");

  const items = [...condition.items];
  let hint = null;

  if (weather.isRaining) {
    const mod = rules.modifiers.find(m => m.id === 'rain');
    if (mod) { hint = mod.hint; if (mod.extraItem) items.push(mod.extraItem); }
  } else if (weather.windKmh > 30) {
    const mod = rules.modifiers.find(m => m.id === 'highWind');
    if (mod) hint = mod.hint;
  } else if (weather.isClear && weather.temp >= 24 && !weather.isNight) {
    const mod = rules.modifiers.find(m => m.id === 'highUV');
    if (mod) hint = mod.hint;
  }

  return { condition, items, hint, weather };
}

function renderForDay(index) {
  selectedDayIndex = index;
  const day = forecastData[index];
  const rec = buildRecommendation(day, currentRules);
  renderUI(rec);
  renderForecastStrip();
}

function renderUI({ condition, items, hint, weather }) {
  document.getElementById('app').classList.remove('loading');
  document.body.style.backgroundColor = condition.bgColor;
  document.getElementById('city-name').textContent      = weather.city;
  document.getElementById('condition-label').textContent = condition.label;
  document.getElementById('temp-display').textContent   = weather.temp + '°';
  document.getElementById('rec-message').textContent    = condition.message;
  document.getElementById('stat-feels').textContent     = weather.feelsLike + '°C';
  document.getElementById('stat-wind').textContent      = weather.windKmh + ' km/h';
  document.getElementById('stat-conditions').textContent = capitalise(weather.description);

  const label = weather.isToday ? 'Right now' : `${weather.dayName} — around midday`;
  document.getElementById('weather-card-label').textContent = label;

  const tagsEl = document.getElementById('clothing-tags');
  tagsEl.innerHTML = items.map(i => `<span class="tag">${i}</span>`).join('');

  const hintEl = document.getElementById('hint');
  if (hint) { hintEl.textContent = hint; hintEl.style.display = 'block'; }
  else      { hintEl.style.display = 'none'; }

  updateCharacter(condition.id, weather.isRaining);
  renderScene(condition.id, weather.isNight ? { ...weather } : weather);
  applyLooks();
}

function skylineSvg(isNight) {
  const bldg    = isNight ? '#1E293B' : 'rgba(71, 85, 105, 0.22)';
  const bldg2   = isNight ? '#0F172A' : 'rgba(71, 85, 105, 0.14)';
  const roof    = isNight ? '#0F172A' : 'rgba(71, 85, 105, 0.28)';
  const winLit  = isNight ? '#FDE68A' : 'rgba(255, 255, 255, 0.45)';
  const winDim  = isNight ? 'rgba(253, 230, 138, 0.35)' : 'rgba(255, 255, 255, 0.25)';

  return `
  <svg style="position:absolute; left:0; right:0; bottom:32px; width:100%; height:88px; pointer-events:none;" viewBox="0 0 360 88" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
    <rect x="18"  y="30" width="30" height="58" fill="${bldg2}"/>
    <rect x="120" y="22" width="26" height="66" fill="${bldg2}"/>
    <rect x="236" y="34" width="34" height="54" fill="${bldg2}"/>
    <rect x="320" y="26" width="24" height="62" fill="${bldg2}"/>

    <rect x="0" y="44" width="36" height="44" fill="${bldg}"/>
    <rect x="6"  y="50" width="6" height="7" fill="${winDim}"/>
    <rect x="16" y="50" width="6" height="7" fill="${winLit}"/>
    <rect x="6"  y="62" width="6" height="7" fill="${winLit}"/>
    <rect x="16" y="62" width="6" height="7" fill="${winDim}"/>

    <rect x="48" y="62" width="34" height="26" fill="${bldg}"/>
    <path d="M44 62 L65 46 L86 62 Z" fill="${roof}"/>
    <rect x="54" y="68" width="7" height="8" fill="${winLit}"/>
    <rect x="69" y="68" width="7" height="8" fill="${winDim}"/>

    <rect x="96" y="36" width="30" height="52" fill="${bldg}"/>
    <rect x="101" y="42" width="6" height="7" fill="${winLit}"/>
    <rect x="112" y="42" width="6" height="7" fill="${winDim}"/>
    <rect x="101" y="54" width="6" height="7" fill="${winDim}"/>
    <rect x="112" y="54" width="6" height="7" fill="${winLit}"/>
    <rect x="101" y="66" width="6" height="7" fill="${winLit}"/>
    <rect x="112" y="66" width="6" height="7" fill="${winDim}"/>

    <rect x="140" y="52" width="28" height="36" fill="${bldg}"/>
    <rect x="145" y="58" width="6" height="7" fill="${winDim}"/>
    <rect x="156" y="58" width="6" height="7" fill="${winLit}"/>
    <rect x="145" y="70" width="6" height="7" fill="${winLit}"/>
    <rect x="156" y="70" width="6" height="7" fill="${winDim}"/>

    <rect x="200" y="64" width="32" height="24" fill="${bldg}"/>
    <path d="M196 64 L216 48 L236 64 Z" fill="${roof}"/>
    <rect x="206" y="70" width="7" height="8" fill="${winDim}"/>
    <rect x="219" y="70" width="7" height="8" fill="${winLit}"/>

    <rect x="248" y="40" width="30" height="48" fill="${bldg}"/>
    <rect x="253" y="46" width="6" height="7" fill="${winLit}"/>
    <rect x="264" y="46" width="6" height="7" fill="${winDim}"/>
    <rect x="253" y="58" width="6" height="7" fill="${winDim}"/>
    <rect x="264" y="58" width="6" height="7" fill="${winLit}"/>
    <rect x="253" y="70" width="6" height="7" fill="${winLit}"/>
    <rect x="264" y="70" width="6" height="7" fill="${winDim}"/>

    <rect x="290" y="56" width="26" height="32" fill="${bldg}"/>
    <rect x="295" y="62" width="6" height="7" fill="${winDim}"/>
    <rect x="305" y="62" width="6" height="7" fill="${winLit}"/>

    <rect x="330" y="48" width="30" height="40" fill="${bldg}"/>
    <rect x="335" y="54" width="6" height="7" fill="${winLit}"/>
    <rect x="346" y="54" width="6" height="7" fill="${winDim}"/>
    <rect x="335" y="66" width="6" height="7" fill="${winDim}"/>
    <rect x="346" y="66" width="6" height="7" fill="${winLit}"/>
  </svg>
  `;
}

function renderScene(state, weather) {
  const card  = document.getElementById('character-card');
  const scene = document.getElementById('scene');

  card.className = 'scene-' + state + (weather.isNight ? ' night' : '');
  scene.innerHTML = skylineSvg(weather.isNight);

  if (weather.isNight) {
    for (let i = 0; i < 20; i++) {
      const left  = Math.floor(Math.random() * 100);
      const top   = Math.floor(Math.random() * 45);
      const delay = (Math.random() * 2.5).toFixed(2);
      scene.innerHTML += `<div class="star" style="left:${left}%; top:${top}%; animation-delay:${delay}s;"></div>`;
    }

    if (weather.isClear) {
      scene.innerHTML += `<div class="moon"></div>`;
      return;
    }

    if (weather.isRaining) {
      scene.innerHTML += `<div class="cloud night-cloud cloud-1"></div>`;
      scene.innerHTML += `<div class="cloud night-cloud cloud-2"></div>`;
      for (let i = 0; i < 14; i++) {
        const left  = Math.floor(Math.random() * 100);
        const delay = (Math.random() * 0.9).toFixed(2);
        scene.innerHTML += `<div class="raindrop" style="left:${left}%; animation-delay:${delay}s;"></div>`;
      }
      return;
    }

    scene.innerHTML += `<div class="moon"></div>`;
    scene.innerHTML += `<div class="cloud night-cloud cloud-1"></div>`;
    return;
  }

  if (weather.isRaining) {
    scene.innerHTML += `<div class="cloud grey-cloud cloud-1"></div>`;
    scene.innerHTML += `<div class="cloud grey-cloud cloud-2"></div>`;
    for (let i = 0; i < 14; i++) {
      const left  = Math.floor(Math.random() * 100);
      const delay = (Math.random() * 0.9).toFixed(2);
      scene.innerHTML += `<div class="raindrop" style="left:${left}%; animation-delay:${delay}s;"></div>`;
    }
    return;
  }

  if (weather.isSnowing) {
    scene.innerHTML += `<div class="cloud grey-cloud cloud-1"></div>`;
    for (let i = 0; i < 12; i++) {
      const left  = Math.floor(Math.random() * 100);
      const delay = (Math.random() * 6).toFixed(2);
      scene.innerHTML += `<span class="snowflake" style="left:${left}%; animation-delay:${delay}s;">❄</span>`;
    }
    return;
  }

  if (weather.isClear) {
    scene.innerHTML += `<div class="sun"></div>`;
    return;
  }

  if (weather.isCloudy || state === 'cool' || state === 'cold') {
    scene.innerHTML += `<div class="cloud cloud-1"></div>`;
    scene.innerHTML += `<div class="cloud cloud-2"></div>`;
    return;
  }

  scene.innerHTML += `<div class="cloud cloud-1"></div>`;
}

function renderForecastStrip() {
  const wrap = document.getElementById('forecast-days');
  wrap.innerHTML = '';

  forecastData.forEach((day, i) => {
    const rec = buildRecommendation(day, currentRules);
    const div = document.createElement('div');
    div.className = 'forecast-day' + (i === selectedDayIndex ? ' selected' : '');
    div.onclick = () => renderForDay(i);
    div.innerHTML = `
      <div class="forecast-day-name">${day.dayName}</div>
      <svg class="forecast-day-svg" viewBox="0 -8 42 63" xmlns="http://www.w3.org/2000/svg">
        ${miniCharacter(rec.condition.id, day.isRaining)}
      </svg>
      <div class="forecast-day-temp">${day.temp}°</div>
    `;
    wrap.appendChild(div);
  });
}

function miniCharacter(state, isRaining) {
  const skin    = currentSkinTone.color;
  const hair    = currentHairColor.color;
  const palette = OUTFIT_PALETTES[currentPalette][state];

  const hairSvg = miniHair(currentHairStyle, hair);
  const head    = `<circle cx="20" cy="10" r="6" fill="${skin}"/>`;

  const umb = isRaining ? `
    <line x1="26" y1="31" x2="26" y2="5" stroke="#7B241C" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M15 6 A11 9.5 0 0 1 37 6 Q34.2 4.4 31.5 6 Q28.8 4.4 26 6 Q23.2 4.4 20.5 6 Q17.8 4.4 15 6 Z" fill="#C0392B"/>
    <line x1="26" y1="-3.5" x2="26" y2="-6" stroke="#7B241C" stroke-width="1.3" stroke-linecap="round"/>
  ` : '';

  let outfit = '';

  if (state === 'hot') {
    outfit = `
      <rect x="14" y="17" width="12" height="10" rx="2" fill="${palette.top}"/>
      <rect x="14" y="27" width="12" height="8" rx="2" fill="${palette.bottom}"/>
      <rect x="15" y="35" width="4" height="12" rx="1" fill="${skin}"/>
      <rect x="21" y="35" width="4" height="12" rx="1" fill="${skin}"/>
    `;
  } else if (state === 'warm' || state === 'mild') {
    outfit = `
      <rect x="13" y="17" width="14" height="12" rx="2" fill="${palette.top}"/>
      <rect x="15" y="29" width="4" height="18" rx="1" fill="${palette.bottom}"/>
      <rect x="21" y="29" width="4" height="18" rx="1" fill="${palette.bottom}"/>
    `;
  } else if (state === 'cool') {
    outfit = `
      <rect x="12" y="17" width="16" height="14" rx="3" fill="${palette.top}"/>
      <rect x="15" y="31" width="4" height="16" rx="1" fill="${palette.bottom}"/>
      <rect x="21" y="31" width="4" height="16" rx="1" fill="${palette.bottom}"/>
    `;
  } else if (state === 'cold') {
    outfit = `
      <rect x="11" y="17" width="18" height="14" rx="3" fill="${palette.top}"/>
      <rect x="15" y="31" width="4" height="16" rx="1" fill="${palette.bottom}"/>
      <rect x="21" y="31" width="4" height="16" rx="1" fill="${palette.bottom}"/>
    `;
  }

  return `${umb}${head}${outfit}${hairSvg}`;
}

function miniHair(style, color) {
  if (style === 'bald') return '';
  if (style === 'spiky') {
    return `<path d="M13.6 9.4 Q12.9 6.6 14 4.8 L14.8 1.8 L15.9 4.4 L17 1 L18.1 4 L20 0.7 L20.8 3.6 L21.9 0.7 L23 4 L24.1 1 L25.2 4.4 L26.3 1.8 L27.1 4.8 Q28.2 6.6 27.5 9.4 Q27.1 8.7 26.3 7.9 Q24.1 5.4 20.4 5.4 Q16.6 5.4 15.1 7.9 Q14.3 8.7 13.6 9.4 Z" fill="${color}"/>`;
  }
  if (style === 'quiff') {
    return `<path d="M13.6 10 Q12.9 4.4 15.5 2.5 Q17.7 -0.2 21.5 0.6 Q20.4 -0.9 23 -0.6 Q26.8 0.8 26.8 4.2 Q27.1 7.6 26.4 10 Q25.7 10.8 25.2 9.7 Q25.6 6.6 23.7 5.5 Q20.8 4.4 18.5 5.1 Q15.5 5.9 14.8 10 Q14 10.8 13.6 10 Z" fill="${color}"/>`;
  }
  if (style === 'swept') {
    return `<path d="M13.6 10.5 Q12.9 4 17.7 2.5 Q23 1 26 4 Q27.5 5.9 26.8 10.5 Q26 11.3 25.7 10.1 Q26 7.5 24.5 6 Q21.5 7.5 17.7 6.7 Q15.5 6.3 14.8 10.1 Q14 11.3 13.6 10.5 Z" fill="${color}"/>`;
  }
  if (style === 'messy') {
    return `<path d="M13.6 9.6 Q12.5 7.7 14 6.3 Q12.9 4.4 15.1 3.6 Q14.8 1.8 17.4 2.2 Q17.7 0.3 20 1 Q22.3 -0.1 23 2.2 Q25.6 1.8 24.9 4.1 Q27.1 4.4 26 6.3 Q27.5 7.7 26.4 9.6 Q25.7 10.4 25.2 9.6 Q24.9 7 22.6 6.1 Q20 5.4 17.4 6.1 Q15.1 7 14.8 9.6 Q14.3 10.4 13.6 9.6 Z" fill="${color}"/>`;
  }
  if (style === 'long') {
    return `<path d="M12.4 24 Q11.6 8 13.4 4.9 Q15.6 1.6 20 1.6 Q24.4 1.6 26.6 4.9 Q28.4 8 27.6 24 Q26.4 25.2 25.2 24 L25.2 8.4 L14.8 8.4 L14.8 24 Q13.6 25.2 12.4 24 Z" fill="${color}"/>`;
  }
  if (style === 'bob') {
    return `<path d="M12.8 15.5 Q11.6 6.5 14 3.8 Q16.4 1.4 20 1.4 Q23.6 1.4 26 3.8 Q28.4 6.5 27.2 15.5 Q26.8 16.7 25.4 16.3 Q24.6 16 24.8 14.7 L24.8 8.4 L15.2 8.4 L15.2 14.7 Q15.4 16 14.6 16.3 Q13.2 16.7 12.8 15.5 Z" fill="${color}"/>`;
  }
  return '';
}

function showError(message) {
  document.getElementById('app').classList.remove('loading');
  document.getElementById('app').innerHTML = `
    <header id="top-bar">
      <span id="app-name">weatherwear</span>
    </header>
    <div id="error-box">
      <p class="icon">🌤</p>
      <p class="msg">${message}</p>
    </div>
  `;
}

function capitalise(str) {
  if (!str) return '--';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Search ──────────────────────────────────

function setupSearch() {
  const btn    = document.getElementById('city-button');
  const box    = document.getElementById('search-box');
  const input  = document.getElementById('search-input');
  const cancel = document.getElementById('search-cancel');

  btn.addEventListener('click', () => {
    box.classList.add('open');
    input.value = '';
    input.focus();
  });

  cancel.addEventListener('click', () => box.classList.remove('open'));

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const city = input.value.trim();
      box.classList.remove('open');
      document.getElementById('app').classList.add('loading');
      try {
        await loadWeatherForCity(city);
      } catch (err) {
        showError(err.message);
      }
    }
  });
}

// ── Settings ────────────────────────────────

function setupSettings() {
  const btn   = document.getElementById('settings-button');
  const panel = document.getElementById('settings-panel');
  btn.addEventListener('click', () => panel.classList.toggle('open'));
}

function buildAllSwatches() {
  buildSkinSwatches();
  buildHairStyles();
  buildHairColors();
  buildPalettes();
}

function buildSkinSwatches() {
  const wrap = document.getElementById('skin-swatches');
  wrap.innerHTML = '';
  SKIN_TONES.forEach(tone => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = tone.color;
    if (tone.id === currentSkinTone.id) b.classList.add('active');
    b.onclick = () => {
      currentSkinTone = tone;
      savePreferences();
      document.querySelectorAll('#skin-swatches .swatch').forEach(s => s.classList.remove('active'));
      b.classList.add('active');
      applyLooks();
      renderForecastStrip();
    };
    wrap.appendChild(b);
  });
}

function buildHairStyles() {
  const wrap = document.getElementById('hair-styles');
  wrap.innerHTML = '';
  HAIR_STYLES.forEach(style => {
    const b = document.createElement('button');
    b.className = 'pill-btn' + (style === currentHairStyle ? ' active' : '');
    b.textContent = style;
    b.onclick = () => {
      currentHairStyle = style;
      savePreferences();
      document.querySelectorAll('#hair-styles .pill-btn').forEach(s => s.classList.remove('active'));
      b.classList.add('active');
      applyLooks();
      renderForecastStrip();
    };
    wrap.appendChild(b);
  });
}

function buildHairColors() {
  const wrap = document.getElementById('hair-colors');
  wrap.innerHTML = '';
  HAIR_COLORS.forEach(hc => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = hc.color;
    if (hc.id === currentHairColor.id) b.classList.add('active');
    b.onclick = () => {
      currentHairColor = hc;
      savePreferences();
      document.querySelectorAll('#hair-colors .swatch').forEach(s => s.classList.remove('active'));
      b.classList.add('active');
      applyLooks();
      renderForecastStrip();
    };
    wrap.appendChild(b);
  });
}

function buildPalettes() {
  const wrap = document.getElementById('outfit-palettes');
  wrap.innerHTML = '';
  Object.keys(OUTFIT_PALETTES).forEach(key => {
    const b = document.createElement('button');
    b.className = 'pill-btn' + (key === currentPalette ? ' active' : '');
    b.textContent = OUTFIT_PALETTES[key].name;
    b.onclick = () => {
      currentPalette = key;
      savePreferences();
      document.querySelectorAll('#outfit-palettes .pill-btn').forEach(s => s.classList.remove('active'));
      b.classList.add('active');
      const day = forecastData[selectedDayIndex];
      const rec = buildRecommendation(day, currentRules);
      renderUI(rec);
    };
    wrap.appendChild(b);
  });
}

function loadPreferences() {
  try {
    const skinId = localStorage.getItem('weatherwear_skin_tone');
    if (skinId) {
      const match = SKIN_TONES.find(t => t.id === skinId);
      if (match) currentSkinTone = match;
    }
    const hairStyle = localStorage.getItem('weatherwear_hair_style');
    if (hairStyle && HAIR_STYLES.includes(hairStyle)) currentHairStyle = hairStyle;

    const hairColorId = localStorage.getItem('weatherwear_hair_color');
    if (hairColorId) {
      const match = HAIR_COLORS.find(c => c.id === hairColorId);
      if (match) currentHairColor = match;
    }
    const palette = localStorage.getItem('weatherwear_palette');
    if (palette && OUTFIT_PALETTES[palette]) currentPalette = palette;
  } catch (e) {}
}

function savePreferences() {
  try {
    localStorage.setItem('weatherwear_skin_tone', currentSkinTone.id);
    localStorage.setItem('weatherwear_hair_style', currentHairStyle);
    localStorage.setItem('weatherwear_hair_color', currentHairColor.id);
    localStorage.setItem('weatherwear_palette', currentPalette);
  } catch (e) {}
}

function applyLooks() {
  applySkinTone();
  applyHair();
}

function applySkinTone() {
  const color = currentSkinTone.color;
  const head = document.getElementById('char-head');
  if (head) head.setAttribute('fill', color);
  document.querySelectorAll('#char-body [data-skin="true"]').forEach(el => {
    el.setAttribute('fill', color);
  });
}

function applyHair() {
  const hair = document.getElementById('char-hair');
  if (!hair) return;
  hair.innerHTML = mainHair(currentHairStyle, currentHairColor.color);
}

function mainHair(style, color) {
  if (style === 'bald') return '';
  if (style === 'spiky') {
    return `<path d="M33 26 Q31 18 34 13 L36 5 L39 12 L42 3 L45 11 L48 2 L50 10 L52 2 L55 11 L58 3 L61 12 L64 5 L66 13 Q69 18 67 26 Q66 24 64 22 Q60 15 50 15 Q40 15 36 22 Q34 24 33 26 Z" fill="${color}"/>`;
  }
  if (style === 'quiff') {
    return `<path d="M33 27 Q31 16 38 11 Q44 4 54 6 Q51 1 58 2.5 Q68 5 68 15 Q69 21 67 27 Q65 29 64 26 Q65 19 60 16 Q52 13 46 15 Q38 17 36 27 Q34 29 33 27 Z" fill="${color}"/>`;
  }
  if (style === 'swept') {
    return `<path d="M33 28 Q31 12 44 8 Q58 4 66 12 Q70 17 68 28 Q66 30 65 27 Q66 20 61 16 Q52 20 42 18 Q38 17 36 27 Q34 30 33 28 Z" fill="${color}"/>`;
  }
  if (style === 'messy') {
    return `<path d="M33 27 Q30 22 34 18 Q31 13 37 11 Q36 6 43 7 Q44 2 50 4 Q56 1 58 7 Q65 6 63 12 Q69 13 66 18 Q70 22 67 27 Q65 29 64 27 Q63 20 57 17.5 Q50 15.5 43 17.5 Q37 20 36 27 Q34 29 33 27 Z" fill="${color}"/>`;
  }
  if (style === 'long') {
    return `<path d="M30 62 Q28 22 33 14 Q39 5 50 5 Q61 5 67 14 Q72 22 70 62 Q67 65 64 62 L64 20 L36 20 L36 62 Q33 65 30 62 Z" fill="${color}"/>`;
  }
  if (style === 'bob') {
    return `<path d="M31 40 Q28 18 34 11 Q41 4 50 4 Q59 4 66 11 Q72 18 69 40 Q68 44 64 43 Q62 42 62.5 39 L62.5 20 L37.5 20 L37.5 39 Q38 42 36 43 Q32 44 31 40 Z" fill="${color}"/>`;
  }
  return '';
}

// ── Character bodies ────────────────────────

function updateCharacter(state, isRaining) {
  const g = document.getElementById('char-body');
  if (!g) return;
  const p = OUTFIT_PALETTES[currentPalette][state];

  const umbrella = isRaining ? `
    <line x1="75" y1="80" x2="75" y2="12" stroke="#7B241C" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M47 14 A28 24 0 0 1 103 14 Q96 10.5 89 14 Q82 10.5 75 14 Q68 10.5 61 14 Q54 10.5 47 14 Z" fill="#C0392B"/>
    <line x1="75" y1="-10" x2="75" y2="-14" stroke="#7B241C" stroke-width="2.5" stroke-linecap="round"/>
  ` : '';

  let body = '';

  if (state === 'hot') {
    body = `
      <rect x="37" y="44" width="26" height="28" rx="3" fill="${p.top}"/>
      <rect x="37" y="44" width="10" height="8" rx="2" fill="${p.top}"/>
      <rect x="53" y="44" width="10" height="8" rx="2" fill="${p.top}"/>
      <rect x="36" y="71" width="12" height="20" rx="3" fill="${p.bottom}"/>
      <rect x="52" y="71" width="12" height="20" rx="3" fill="${p.bottom}"/>
      <rect x="36" y="71" width="28" height="9" rx="2" fill="${p.bottomDark}"/>
      <rect x="37" y="90" width="10" height="28" rx="4" data-skin="true"/>
      <rect x="53" y="90" width="10" height="28" rx="4" data-skin="true"/>
      <ellipse cx="42" cy="120" rx="8" ry="4" fill="${p.shoes}"/>
      <ellipse cx="58" cy="120" rx="8" ry="4" fill="${p.shoes}"/>
      <rect x="21" y="44" width="15" height="9" rx="4" data-skin="true"/>
      <rect x="64" y="44" width="15" height="9" rx="4" data-skin="true"/>
      <rect x="20" y="52" width="10" height="22" rx="4" data-skin="true"/>
      <rect x="70" y="52" width="10" height="22" rx="4" data-skin="true"/>
    `;
  } else if (state === 'warm') {
    body = `
      <rect x="34" y="44" width="32" height="30" rx="3" fill="${p.top}"/>
      <rect x="23" y="44" width="14" height="14" rx="4" fill="${p.top}"/>
      <rect x="63" y="44" width="14" height="14" rx="4" fill="${p.top}"/>
      <rect x="36" y="73" width="12" height="20" rx="3" fill="${p.bottom}"/>
      <rect x="52" y="73" width="12" height="20" rx="3" fill="${p.bottom}"/>
      <rect x="36" y="73" width="28" height="9" rx="2" fill="${p.bottomDark}"/>
      <rect x="37" y="92" width="10" height="26" rx="4" data-skin="true"/>
      <rect x="53" y="92" width="10" height="26" rx="4" data-skin="true"/>
      <ellipse cx="42" cy="120" rx="8" ry="4" fill="${p.shoes}"/>
      <ellipse cx="58" cy="120" rx="8" ry="4" fill="${p.shoes}"/>
      <rect x="23" y="54" width="10" height="20" rx="4" fill="${p.top}"/>
      <rect x="67" y="54" width="10" height="20" rx="4" fill="${p.top}"/>
      <ellipse cx="28" cy="75" rx="6" ry="5" data-skin="true"/>
      <ellipse cx="72" cy="75" rx="6" ry="5" data-skin="true"/>
    `;
  } else if (state === 'mild') {
    body = `
      <rect x="34" y="44" width="32" height="30" rx="3" fill="${p.top}"/>
      <rect x="23" y="44" width="14" height="14" rx="4" fill="${p.top}"/>
      <rect x="63" y="44" width="14" height="14" rx="4" fill="${p.top}"/>
      <rect x="36" y="73" width="12" height="36" rx="3" fill="${p.bottom}"/>
      <rect x="52" y="73" width="12" height="36" rx="3" fill="${p.bottom}"/>
      <rect x="36" y="73" width="28" height="9" rx="2" fill="${p.bottomDark}"/>
      <ellipse cx="42" cy="111" rx="8" ry="4" fill="${p.shoes}"/>
      <ellipse cx="58" cy="111" rx="8" ry="4" fill="${p.shoes}"/>
      <rect x="23" y="54" width="10" height="20" rx="4" fill="${p.top}"/>
      <rect x="67" y="54" width="10" height="20" rx="4" fill="${p.top}"/>
      <ellipse cx="28" cy="75" rx="6" ry="5" data-skin="true"/>
      <ellipse cx="72" cy="75" rx="6" ry="5" data-skin="true"/>
    `;
  } else if (state === 'cool') {
    body = `
      <rect x="31" y="43" width="38" height="36" rx="5" fill="${p.top}"/>
      <path d="M38 43 Q50 35 62 43" fill="${p.topDark}" stroke="none"/>
      <rect x="40" y="63" width="20" height="12" rx="3" fill="${p.topDark}"/>
      <rect x="19" y="43" width="14" height="33" rx="5" fill="${p.top}"/>
      <rect x="67" y="43" width="14" height="33" rx="5" fill="${p.top}"/>
      <rect x="19" y="71" width="14" height="6" rx="2" fill="${p.topDark}"/>
      <rect x="67" y="71" width="14" height="6" rx="2" fill="${p.topDark}"/>
      <ellipse cx="26" cy="78" rx="6" ry="5" data-skin="true"/>
      <ellipse cx="74" cy="78" rx="6" ry="5" data-skin="true"/>
      <rect x="36" y="78" width="12" height="36" rx="3" fill="${p.bottom}"/>
      <rect x="52" y="78" width="12" height="36" rx="3" fill="${p.bottom}"/>
      <rect x="36" y="77" width="28" height="9" rx="2" fill="${p.bottomDark}"/>
      <ellipse cx="42" cy="116" rx="8" ry="4" fill="${p.shoes}"/>
      <ellipse cx="58" cy="116" rx="8" ry="4" fill="${p.shoes}"/>
    `;
  } else if (state === 'cold') {
    body = `
      <rect x="30" y="43" width="40" height="36" rx="5" fill="${p.top}"/>
      <path d="M44 43 L50 52 L56 43" fill="${p.topDark}" stroke="none"/>
      <rect x="18" y="43" width="14" height="35" rx="5" fill="${p.top}"/>
      <rect x="68" y="43" width="14" height="35" rx="5" fill="${p.top}"/>
      <line x1="50" y1="46" x2="50" y2="78" stroke="#566573" stroke-width="1.5"/>
      <rect x="18" y="72" width="14" height="7" rx="2" fill="${p.topDark}"/>
      <rect x="68" y="72" width="14" height="7" rx="2" fill="${p.topDark}"/>
      <ellipse cx="25" cy="80" rx="6" ry="5" data-skin="true"/>
      <ellipse cx="75" cy="80" rx="6" ry="5" data-skin="true"/>
      <rect x="36" y="78" width="12" height="36" rx="3" fill="${p.bottom}"/>
      <rect x="52" y="78" width="12" height="36" rx="3" fill="${p.bottom}"/>
      <rect x="36" y="77" width="28" height="9" rx="2" fill="${p.bottomDark}"/>
      <ellipse cx="42" cy="116" rx="9" ry="4" fill="${p.shoes}"/>
      <ellipse cx="58" cy="116" rx="9" ry="4" fill="${p.shoes}"/>
    `;
  }

  g.innerHTML = umbrella + body;
}

init();