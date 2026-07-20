# WeatherWear

A weather based clothing app. It checks the live weather where you are and shows you what to wear, through a customisable character that dresses for the conditions, with animated day and night scenes, and a 3 day outfit forecast.

**Live:** https://weatherwear-app.netlify.app

## What it does

- Detects your location as well as the feature to search for any city and fetches live weather
- Maps the temperature and conditions to a clothing recommendation
- Dresses an SVG character for the weather with five outfits from hot to cold
- Renders an animated scene behind the character with aspects like the sun, drifting clouds, falling rain, snow, plus a night mode with a moon, stars, and lit up city windows
- Shows a 3 day forecast strip with mini characters you can tap to see each day's outfit
- Lets you customise the character through skin tone, hair style, hair colour, and outfit palette which are consistent between visits

## How it works

The recommendation logic is a hand written rules engine (`rules.json`): temperature falls into one of five bands, each with its own clothing list and message and separate modifiers layer on top for rain, wind, and UV. Weather accessories like the umbrella render independently of the outfit state, so they appear in any condition when it's raining.

Two OpenWeatherMap endpoints power the app the current conditions and the 5 day forecast which are both called through a serverless proxy rather than directly from the browser.

## Keeping the API key secure

The OpenWeatherMap key is never exposed in the frontend. The browser calls a Netlify serverless function (`netlify/functions/weather.js`), which holds the key as an environment variable on the server and makes the actual API request. The key never reaches the client or the public source code.

## Built with

- Plain HTML, CSS, and JavaScript, no frameworks
- SVG for the character and scenes
- OpenWeatherMap API (current + forecast endpoints)
- Netlify (hosting + serverless function)
- localStorage for saved preferences

## Running it yourself

Because weather is fetched through a Netlify function, the full app runs on Netlify rather than a plain local server. To run locally you'd use the Netlify CLI with an `OPENWEATHER_API_KEY` environment variable set.

---

Built as my first web development project and a solution to a problem i kept asking myself.
