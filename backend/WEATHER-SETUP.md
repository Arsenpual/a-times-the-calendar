# Telegram Weather Controller

## Configure the backend

1. Enable billing, Weather API, and Geocoding API in your Google Cloud project.
2. Create a server API key restricted to these two APIs. Set appropriate API quotas in Google Cloud.
3. Set `GOOGLE_WEATHER_API_KEY` in Render's backend environment. Never place the key in frontend configuration or Telegram messages.
4. For AI advice, retain the existing `GEMINI_API_KEY`, `GEMINI_CHAT_ENABLED`, and `GEMINI_CHAT_DEVELOPER_UIDS` configuration. AI advice uses the existing developer access rules and Gemini quota. Linked accounts without AI access still receive weather data.
5. Deploy the backend. Startup republishes the shared Bot Menu including `/weather`, `/weather_ask`, and `/weather_cancel`.

Google documentation:
- https://developers.google.com/maps/documentation/weather/get-api-key
- https://developers.google.com/maps/documentation/weather/hourly-forecast
- https://developers.google.com/maps/documentation/weather/policies

## Use in Telegram

- Connect T.i.M.E.S. with the bot and use its private chat.
- `/weather` opens the controller. `/weather อำเภอเมือง เชียงใหม่` selects a place directly.
- Choose ตอนนี้, วันนี้, พรุ่งนี้, or 3 วัน. Today and tomorrow display local-hour forecasts at three-hour intervals; already elapsed hours are unavailable from the forecast endpoint.
- เปลี่ยนสถานที่ prompts for a specific address. Reply to that prompt, or send a location using Telegram's attachment menu while the location prompt is active. Ambiguous geocoding results require a more specific query.
- Save up to five favorite locations with your own labels; select and delete them in สถานที่โปรด.
- Ask AI using the button or `/weather_ask พรุ่งนี้เย็นเหมาะกับวิ่งไหม`. Questions use the selected location and up to 48 hours of hourly data plus three daily forecasts. Dates outside those returned observations are unsupported and must not be invented by AI.
- `/weather_cancel` closes the session. Ordinary notes are not consumed: textual inputs must reply to the active prompt.

The controller session expires after 30 minutes of inactivity and is reset when the backend restarts. Favorites persist in Firestore. Stored favorites contain user-supplied place queries or user-shared GPS coordinates and labels, not forecast responses or geocoding results. Named favorites are geocoded again when selected. No automatic weather notifications are sent.

## Verification

Run `node --test backend/tests/telegram-weather.test.js backend/tests/telegram-menu.test.js` from the repository root. The automated tests use mock Google/Gemini responses and do not consume API quota.

After deployment, verify one named location and one shared GPS location, today/tomorrow around the location's midnight, favorite selection/removal, AI advice and unavailable forecast dates, and the no-AI fallback. Live Google/Telegram requests require production credentials and are not verified by the mock tests.
