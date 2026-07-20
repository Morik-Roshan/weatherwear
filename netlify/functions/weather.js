exports.handler = async function (event) {
  const API_KEY = process.env.OPENWEATHER_API_KEY;

  const { lat, lon, city, type } = event.queryStringParameters || {};

  let url;
  const base = type === 'forecast'
    ? 'https://api.openweathermap.org/data/2.5/forecast'
    : 'https://api.openweathermap.org/data/2.5/weather';

  if (city) {
    url = `${base}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
  } else if (lat && lon) {
    url = `${base}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing location' }) };
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      statusCode: res.status,
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Weather fetch failed' }) };
  }
};
