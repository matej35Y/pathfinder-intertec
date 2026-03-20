# PathFinder 🚀

PathFinder is a high-performance, polished mobile application built with **React Native** and **Expo**. It allows users to track their activities (Running, Cycling, Walking) in real-time with live map visualization, persistent storage, and route replays.

![PathFinder Overview](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue?style=for-the-badge&logo=react)
![Expo](https://img.shields.io/badge/Expo-54.0.0-black?style=for-the-badge&logo=expo)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

## ✨ Features

- **Live Activity Tracking**: Real-time GPS tracking with duration, distance, and live polyline rendering.
- **Multi-Activity Support**: Optimized tracking modes for Running, Cycling, and Walking.
- **Advanced Map Integration**: 
  - **Android**: Custom MapTiler raster tiles for consistent high-detail rendering.
  - **iOS**: Native Apple Maps integration for buttery-smooth performance and zero-tile-glitch experience.
- **Offline Persistence**: Local storage using **Expo SQLite** for lightning-fast history access and privacy.
- **Route Replay**: Comprehensive activity history with the ability to review past routes on an interactive map.
- **Premium UI/UX**: Built with **NativeWind** (Tailwind CSS for React Native) featuring:
  - Full Dark Mode support.
  - Smooth micro-animations (Shared Values via Reanimated).
  - Modern, high-contrast aesthetic with glassmorphism elements.

## 🛠 Tech Stack

- **Framework**: [Expo SDK 54](https://expo.dev/) (Managed Workflow)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) (Lightweight, decoupled store)
- **Styling**: [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS engine)
- **Animations**: [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- **Database**: [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Maps**: [React Native Maps](https://github.com/react-native-maps/react-native-maps) with MapTiler integration.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Expo Go](https://expo.dev/expo-go) app on your physical device OR a simulator.
- A [MapTiler](https://www.maptiler.com/) account for free API keys.

### Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_MAPTILER_API_KEY=your_maptiler_key_here
   ```

3. **Run the App**:
   - For **Android**: `npm run android`
   - For **iOS**: `npm run ios`
   - General Start: `npx expo start`
  
   - !!! Please have in mind that you need at least EXPO SDK 54.0 version to test the app. Recommended SDK 54.2 version. !!!

---

## 🏗 Architecture & Design Decisions

### 1. Hybrid MapTiler Integration
To provide a premium experience while remaining 100% compatible with **Expo Go**:
- **Android**: Uses **MapTiler Raster Tiles** via the `<UrlTile />` component. This ensures a high-detail, custom MapTiler "Streets" aesthetic that is consistent across all Android devices.
- **iOS**: Defaults to the **Native Apple Maps** base layer. This was a deliberate choice to provide the smoothest possible performance and eliminate any "tile flickering" during fast pans or zooms on iOS devices.
- **Unified Logic**: Both platforms share the same core `MapView` implementation, ensuring that markers, polylines, and tracking logic work identically regardless of the underlying tile provider.

### 2. Decoupled Business Logic
Business logic is extracted into custom hooks (`useTrackingSession`) and services (`db.ts`, `location/`), keeping the UI components clean and focused purely on layout and user interaction.

### 3. Reactive State with Zustand
I chose **Zustand** over Redux or Context API for its minimal boilerplate and superior performance when handling high-frequency state updates (like GPS coordinate streams).

### 4. Efficient Persistence
Tracked routes are stored as serialized JSON in **SQLite**, allowing me to handle thousands of data points per session without compromising performance or running into storage limits common with `AsyncStorage`.

## 🛡 Edge Case & Reliability

I've prioritized stability by handling several critical edge cases:

- **Permission Denial**: If location permission is denied or revoked, the app presents a clear, actionable UI instead of crashing, allowing users to jump directly to system settings.
- **GPS Jitter & Duplicates**: The `trackingStore` includes a haversine distance filter that ignores movements smaller than 0.5 meters, preventing "distance drift" when the user is standing still.
- **Empty Sessions**: If a user hits "Stop" without any recorded points, the app alerts the user and prevents saving a "ghost" activity.
- **Theme Transitions**: Seamless switching between Dark and Light modes using NativeWind, with specific colors optimized for map visibility in high-glare environments.

---

## 🧠 Project Retro & Challenges

### The "Map Tile" Dilemma
The biggest challenge was achieving a professional, high-performance map experience while maintaining **Expo Go compatibility**. 
- **The Issue**: MapLibre is powerful but requires custom native builds, breaking the seamless Expo Go workflow. Traditional `react-native-maps` can feel "stock" or inconsistent across platforms.
- **The Solution**: I implemented a **Hybrid Provider Strategy**. By using MapTiler raster tiles on Android and defaulting to Apple Maps on iOS, I achieved a unique, premium look on both platforms without leaving the Expo Go ecosystem.

### Database Schema Evolution
Migrating local data during a rapid development cycle can be tricky. I implemented a robust `initDB` routine in `src/services/db.ts` that gracefully handles schema changes (like adding the `name` and `activityType` columns) without wiping user history.

## 🤖 AI-Assisted Development

This project was developed using an AI-assisted workflow, primarily leveraging **Antigravity** for rapid refactoring and cleanup, alongside **ChatGPT** and **Cursor** for initial prototyping. All features were rigorously validated on an **Android Studio Emulator** to ensure smooth performance and reliable tracking.

---

## 📂 Project Structure

```text
pathfinder/
├── app/               # Expo Router screens & layouts
│   ├── (tabs)/        # Main tab navigation (Track, History)
│   └── activity/      # Dynamic activity detail screens
├── src/
│   ├── components/    # Reusable UI & Map components
│   ├── hooks/         # Custom hooks (Location, Tracking)
│   ├── services/      # Database & API logic
│   ├── store/         # Zustand state management
│   └── types/         # TypeScript definitions
└── assets/            # Static images and icons
```


---
*Built with ❤️ for the INTERTEC Technical Assessment.*
