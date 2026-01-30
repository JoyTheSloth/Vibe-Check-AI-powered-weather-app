// --- DOM ELEMENTS ---
const app = {
    cityInput: document.getElementById('city-input'),
    searchTrigger: document.getElementById('search-trigger'),
    searchConfirmBtn: document.getElementById('search-confirm-btn'),
    modal: document.getElementById('search-modal'),
    closeModal: document.getElementById('close-modal'),

    geoBtn: document.getElementById('geo-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    gravityToggle: document.getElementById('gravity-toggle'),

    chatToggle: document.getElementById('chat-toggle'),
    chatWindow: document.getElementById('chat-window'),
    closeChat: document.getElementById('close-chat'),
    chatInput: document.getElementById('chat-input'),
    sendChatBtn: document.getElementById('send-chat'),
    chatMsgs: document.getElementById('chat-messages'),

    // UI Output
    cityName: document.getElementById('city-name'),
    dateTime: document.getElementById('date-time'),
    temp: document.getElementById('current-temp'),
    desc: document.getElementById('weather-desc'),
    humidity: document.getElementById('humidity'),
    wind: document.getElementById('wind-speed'),
    uv: document.getElementById('uv-index'),
    rain: document.getElementById('rain-chance'),
    sunrise: document.getElementById('sunrise'),
    sunset: document.getElementById('sunset'),
    icon: document.getElementById('weather-icon'),

    hourlyContainer: document.getElementById('hourly-container'),
    forecastContainer: document.getElementById('forecast-container')
};

// --- STATE ---
let state = {
    weather: null,
    isAntiGravity: false,
    themeIndex: 0,
    themes: [
        { name: "Dreamy", grad: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)" },
        { name: "Neon Night", grad: "linear-gradient(135deg, #09203f 0%, #537895 100%)" },
        { name: "Sunset City", grad: "linear-gradient(to right, #ff512f, #dd2476)" },
        { name: "Minty Fresh", grad: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
        { name: "Dark Plasma", grad: "linear-gradient(135deg, #2b5876 0%, #4e4376 100%)" }
    ]
};

// --- INIT ---
window.addEventListener('load', () => {
    generateParticles();
    fetchWeatherByCity('New York');
    updateTime();
    setInterval(updateTime, 60000);
});

function updateTime() {
    const now = new Date();
    app.dateTime.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        " • " + now.toLocaleDateString([], { weekday: 'long', day: 'numeric' });
}

// --- EVENT LISTENERS ---
// Search Modal interactions
app.searchTrigger.addEventListener('click', () => app.modal.classList.remove('hidden'));
app.closeModal.addEventListener('click', () => app.modal.classList.add('hidden'));
app.searchConfirmBtn.addEventListener('click', () => {
    fetchWeatherByCity(app.cityInput.value);
    app.modal.classList.add('hidden');
    app.cityInput.value = '';
});

app.geoBtn.addEventListener('click', getGeoLocation);
app.themeToggle.addEventListener('click', cycleTheme);
app.gravityToggle.addEventListener('click', toggleGravity);

// Chatbot interactions
app.chatToggle.addEventListener('click', () => app.chatWindow.classList.toggle('hidden'));
app.closeChat.addEventListener('click', () => app.chatWindow.classList.add('hidden'));
app.sendChatBtn.addEventListener('click', handleUserChat);
app.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleUserChat() });


// --- API LOGIC ---

async function fetchWeatherByCity(city) {
    if (!city) return;
    app.desc.innerText = "Loading...";

    try {
        const geoReq = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`);
        const geoData = await geoReq.json();

        if (!geoData.results) {
            alert("City not found 💀");
            return;
        }

        const { latitude, longitude, name, country } = geoData.results[0];
        app.cityName.innerText = `${name}, ${country}`;

        fetchWeatherData(latitude, longitude);

    } catch (e) {
        console.error(e);
        app.desc.innerText = "API Error";
    }
}

function getGeoLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            fetchWeatherData(pos.coords.latitude, pos.coords.longitude);
            app.cityName.innerText = "My Location 📍";
        });
    }
}

async function fetchWeatherData(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum&timezone=auto`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        state.weather = data;
        renderApp(data);
    } catch (e) {
        console.error(e);
    }
}


// --- RENDER LOGIC ---

function renderApp(data) {
    const current = data.current;

    // 1. Hero
    app.temp.innerText = Math.round(current.temperature_2m) + "°";
    app.humidity.innerText = current.relative_humidity_2m + "%";
    app.wind.innerText = current.wind_speed_10m + " km/h";

    // UV & Rain from Hourly/Daily approx
    const maxUv = Math.max(...data.hourly.uv_index.slice(0, 24));
    app.uv.innerText = maxUv.toFixed(1);

    // Rain PROBABILITY for next 24h max
    const maxRainProb = Math.max(...data.hourly.precipitation_probability.slice(0, 24));
    app.rain.innerText = maxRainProb + "%";

    // Sun Times
    app.sunrise.innerText = new Date(data.daily.sunrise[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    app.sunset.innerText = new Date(data.daily.sunset[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Visuals
    const config = getWeatherConfig(current.weather_code, current.is_day);
    app.desc.innerText = config.desc;
    app.icon.src = config.icon;

    // 2. Hourly Forecast
    renderHourly(data.hourly);

    // 3. Daily Forecast
    renderDaily(data.daily);
}

function renderHourly(hourly) {
    app.hourlyContainer.innerHTML = '';

    // Get next 24 hours relative to now
    // API returns standard ISO times. Let's just take the first 24 indices since "current" is close to index 0 usually
    // Or simpler: Current hour index calculation
    const nowHour = new Date().getHours();

    for (let i = nowHour; i < nowHour + 24; i++) {
        // Handle array bounds
        if (i >= hourly.time.length) break;

        const time = new Date(hourly.time[i]).getHours();
        const timeStr = time + ":00";
        const temp = Math.round(hourly.temperature_2m[i]);
        const icon = getWeatherConfig(hourly.weather_code[i], 1).emoji; // assume day for icon simplicity

        const div = document.createElement('div');
        div.className = 'hourly-card glass-panel';
        div.innerHTML = `
            <span style="font-size:0.8rem; opacity:0.8">${timeStr}</span>
            <span style="font-size:1.5rem">${icon}</span>
            <span style="font-weight:bold">${temp}°</span>
        `;
        app.hourlyContainer.appendChild(div);
    }
}

function renderDaily(daily) {
    app.forecastContainer.innerHTML = '';

    daily.time.forEach((t, i) => {
        const date = new Date(t).toLocaleDateString('en-US', { weekday: 'short' });
        const max = Math.round(daily.temperature_2m_max[i]);
        const min = Math.round(daily.temperature_2m_min[i]);
        const config = getWeatherConfig(daily.weather_code[i], 1);

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <h3>${date}</h3>
            <div class="forecast-icon">${config.emoji}</div>
            <p><strong>${max}°</strong> <span style="opacity:0.6">/ ${min}°</span></p>
        `;
        app.forecastContainer.appendChild(card);
    });
}

// --- UTILS ---

function getWeatherConfig(code, isDay) {
    // WMO codes
    let desc = "Clear";
    let emoji = "☀️";
    let icon = "https://cdn-icons-png.flaticon.com/512/869/869869.png";

    if (code >= 1 && code <= 3) { desc = "Cloudy"; emoji = "☁️"; icon = "https://cdn-icons-png.flaticon.com/512/1146/1146869.png"; }
    else if (code >= 45 && code <= 48) { desc = "Foggy"; emoji = "🌫️"; }
    else if (code >= 51 && code <= 67) { desc = "Rainy"; emoji = "🌧️"; icon = "https://cdn-icons-png.flaticon.com/512/3351/3351979.png"; }
    else if (code >= 71) { desc = "Snow"; emoji = "❄️"; icon = "https://cdn-icons-png.flaticon.com/512/2315/2315309.png"; }
    else if (code >= 95) { desc = "Storm"; emoji = "⛈️"; icon = "https://cdn-icons-png.flaticon.com/512/1146/1146860.png"; }

    return { desc, emoji, icon };
}

function cycleTheme() {
    state.themeIndex = (state.themeIndex + 1) % state.themes.length;
    document.body.style.background = state.themes[state.themeIndex].grad;
}

function generateParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 8 + 2;
        p.style.width = p.style.height = `${size}px`;
        p.style.left = `${Math.random() * 100}vw`;
        p.style.animationDuration = `${Math.random() * 10 + 10}s`;
        container.appendChild(p);
    }
}

function toggleGravity() {
    state.isAntiGravity = !state.isAntiGravity;
    document.body.classList.toggle('anti-gravity');
    if (state.isAntiGravity) document.addEventListener('mousemove', parallax);
    else document.removeEventListener('mousemove', parallax);
}

function parallax(e) {
    const layers = document.querySelectorAll('.parallax-layer');
    const x = (e.clientX - window.innerWidth / 2) / 100;
    const y = (e.clientY - window.innerHeight / 2) / 100;

    layers.forEach(layer => {
        const s = layer.getAttribute('data-speed') || 1;
        layer.style.transform = `translate(${x * s}px, ${y * s}px)`;
    });
}

// --- CHATBOT ---
window.askBot = function (c) {
    if (c === 'outfit') handleUserChat("What should I wear?");
    if (c === 'rain') handleUserChat("Will it rain?");
};

function handleUserChat(FORCE_TEXT = null) {
    const input = typeof FORCE_TEXT === 'string' ? FORCE_TEXT : app.chatInput.value;
    if (!input) return;

    addMsg(input, 'user');
    app.chatInput.value = '';

    if (!state.weather) {
        setTimeout(() => addMsg("Let me locate you first! 🌍", 'bot'), 500);
        return;
    }

    const lower = input.toLowerCase();
    let reply = "I'm just a vibe bot, I don't know that! 💀";

    if (lower.includes('rain')) {
        const prob = Math.max(...state.weather.hourly.precipitation_probability.slice(0, 12));
        reply = prob > 30 ? `Yep, ${prob}% chance coming up. Bring an umbrella! ☔` : "Nah, dry vibes ahead. ☀️";
    } else if (lower.includes('wear') || lower.includes('clothes')) {
        const t = state.weather.current.temperature_2m;
        reply = t < 15 ? "It's giving chilly. Wear a jacket! 🧥" : "It's warm! T-shirt time. 👕";
    }

    setTimeout(() => addMsg(reply, 'bot'), 600);
}

function addMsg(txt, sender) {
    const div = document.createElement('div');
    div.className = `msg ${sender}`;
    div.innerText = txt;
    app.chatMsgs.appendChild(div);
    app.chatMsgs.scrollTop = app.chatMsgs.scrollHeight;
}
