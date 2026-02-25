# 🌟 LifeHub (WIP)

> **One Space. Every Workspace. Total Control.**

LifeHub is your centralized "Command Center" for everything that matters. Whether it's tracking finances, managing work tasks, or checking your personal calendar, LifeHub brings it all together into a beautiful, type-safe, and highly secure ecosystem.

Designed for the modern multi-tasker, LifeHub works perfectly on **Desktop**, **Mobile**, and even low-power **E-Ink (Inkplate 6)** displays.

Disclaimer: This is vibe coded personal hobby project tailored to my needs. If you need something you need to work it and change it yourself

---

## ✨ The Magic Features

### 🏢 Multi-Workspace Isolation
Separate your **Work** and **Personal** life with surgical precision. Each workspace is isolated, ensuring that your work emails don't clutter your personal peace of mind, while still being accessible from one unified dashboard.

### 📟 E-Ink Optimized (The "Ambient View")
Got an Inkplate 6? LifeHub includes a dedicated E-Ink engine.
- **Privacy First:** Mask sensitive financial data or hide specific modules for "public" displays.
- **Smart Refresh:** Dynamic sleep cycles based on your device's battery level.
- **Ambient Awareness:** Always see your most relevant tasks without lifting a finger.

### 🛡️ Type-Safe "Plug & Play"
Forget brittle JSON maps. LifeHub's **Integration Engine** is built in Go with strict domain models. Adding a new source (Slack, Google, Mail) is like plugging in a Lego brick—it's guaranteed to work, and it's protected by our **Operation-Driven Security** model.

### ⚡ Real-Time Pulse
Built on **PocketBase**, your web dashboard has a heartbeat. When a new task arrives or a transaction is logged, the UI updates instantly. No refresh needed.

---

## 🛠️ The Tech Stack

| Component | Technology | Why? |
| :--- | :--- | :--- |
| **Backend** | Go + PocketBase | Blazing speed, embedded DB, and a killer Admin UI. |
| **Frontend** | Next.js (App Router) | Modern, responsive, and SEO-friendly by default. |
| **E-Ink** | MicroPython | Efficient, easy to debug, and perfect for the ESP32. |
| **Security** | Token + Operations | Granular control over *who* sees *what* and *how*. |

---

## 🚀 Quick Start: Ignite the Hub

### 1️⃣ Fire up the Backend
```bash
cd backend
go mod tidy
go run main.go serve
```
Open [http://127.0.0.1:8090/_/](http://127.0.0.1:8090/_/) to create your admin account. Your collections are already migrated and ready for data!

### 2️⃣ Launch the Dashboard
```bash
cd frontend
npm install
npm run dev
```
Check it out at [http://localhost:3000](http://localhost:3000).

### 4️⃣ Enable Google OAuth
To use the "Sign in with Google" feature:
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project and set up **OAuth 2.0 Client IDs**.
3.  Add `http://127.0.0.1:8090/api/oauth2-redirect` to your **Authorized redirect URIs**.
4.  In the PocketBase Admin UI, navigate to **Settings > Auth providers > Google**.
5.  Paste your **Client ID** and **Client Secret** and save.

### 5️⃣ Sync your E-Ink Display
Update `eink_client/main.py` with your token and WiFi. Flash it, and watch your life appear on the 6" display.

---

## 🧩 Building the Future
Want to add a new integration? It’s a breeze.
1. Implement the `Source` interface in `backend/internal/sources/`.
2. Define your `Result` type in `domain`.
3. Register and Watch it work.

---

## 📜 License
Personal Project - Built with ❤️ for total life optimization.
