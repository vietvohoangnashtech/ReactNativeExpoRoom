# XPW2 — Offline-First Event-Driven Body Management Android App

Enterprise-grade offline-first event-driven body management application built with React Native, Expo, and custom Android modules for secure cross-tablet synchronization, NFC member identification, and weight measurement integration.

## 🎯 Overview

XPW2 is a sophisticated mobile application designed for group fitness/wellness sessions. It enables:

- **Event-Driven Architecture**: All state changes recorded as immutable events
- **Offline-First**: Full functionality without internet; syncs when connected
- **Cross-Tablet Collaboration**: Real-time event exchange between tablets via Google Nearby Connections
- **Encrypted Local Storage**: SQLCipher-encrypted Room database with Android Keystore
- **Member Identification**: NFC card scanning and digital member search
- **Weight Tracking**: BLE wireless scale integration with IEEE 11073 parsing
- **Reliable Sync**: Outbox pattern with WorkManager background scheduling

## 🏗️ Architecture

### 4-Layer Design

```
Layer 1 — React Native UI
├── Screens (screens/), Redux state (store/), Navigation (expo-router)
├── Shared components (components/), hooks (hooks/), services (services/)
└── Feature modules (features/<name>/)

Layer 2 — Application Abstraction
├── IDataRepository interface
├── Feature flags
└── Offline-first routing logic

Layer 3 — Bridge Layer
├── Expo Modules API
├── AsyncFunction / Events
└── JS ↔ Kotlin serialization

Layer 4 — Native Core
├── DataSync Engine SSOT (Kotlin)
├── Room Database + SQLCipher
├── WorkManager background sync
├── Google Nearby P2P connections
├── NFC card reading (Kotlin + JS bridge)
└── BLE weight scale integration
```

### Monorepo Structure

```
ReactNativeExpoRoom/
├── apps/
│   └── mobile/                 # Main Expo app (React Native)
│
├── packages/
│   ├── datasync/               # CORE: Expo Module (Kotlin + TS)
│   ├── shared/                 # TypeScript types & constants
│   ├── nfc/                    # NFC reader module (Kotlin + TS)
│   ├── ble-scale/              # BLE scale reader module (Kotlin + TS)
│   ├── ui/                     # Shared UI components
│   └── tsconfig/               # Shared TypeScript configs
│
├── docs/                       # Complete documentation
├── .github/
│   ├── instructions/           # Coding rules (8 files)
│   └── agents/                 # Specialized Copilot agents (4)
│
└── pnpm-workspace.yaml         # Monorepo config
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.0.0+
- **pnpm** 10.0.0+ (`npm install -g pnpm`)
- **JDK 17** (for Android)
- **Android SDK 35+**
- **Git**

### Installation

```bash
# Install all dependencies
pnpm install

# Start Expo dev server
npx expo start

# In another terminal, run on Android device/emulator
npx expo run:android

# or use dev client
# Press 'a' in the dev server terminal
```

### Build Android APK

```bash
# Generate native project
npx expo prebuild --platform android --clean

# Build unsigned debug APK
cd apps/mobile/android && ./gradlew assembleDebug

# APK location: apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## 📚 Documentation

Complete documentation available in `docs/`:

1. **[01-project-setup.md](docs/01-project-setup.md)** — Prerequisites, installation, configuration
2. **[02-architecture.md](docs/02-architecture.md)** — 4-layer design, data flow
3. **[03-datasync-module.md](docs/03-datasync-module.md)** — Room, SQLCipher, KSP setup
4. **[04-event-model.md](docs/04-event-model.md)** — Event envelope, idempotency, all 10 event types
5. **[05-cross-tablet-sync.md](docs/05-cross-tablet-sync.md)** — Nearby Connections, device discovery
6. **[06-backend-sync.md](docs/06-backend-sync.md)** — WorkManager, batch upload, retry logic
7. **[07-nfc-scales.md](docs/07-nfc-scales.md)** — NFC reading, BLE scale parsing
8. **[08-auth-security.md](docs/08-auth-security.md)** — JWT, encryption, keystore
9. **[09-testing-guide.md](docs/09-testing-guide.md)** — Jest, mocking, testing pyramid
10. **[10-ui-components.md](docs/10-ui-components.md)** — Shared UI components, usage

## 🧪 Testing

```bash
# Run all tests (99 total)
pnpm test

# Run specific workspace tests
cd apps/mobile && npx jest
cd packages/shared && npx jest

# Watch mode
npx jest --watch

# Coverage report
npx jest --coverage
```

**Test Statistics:**
- Mobile app: 69 tests (Redux slices, services, auth)
- Shared package: 30 tests (events, types, constants)
- **Coverage**: Unit tests cover critical paths, integrations, edge cases

## 🛠️ Development

### Key Technologies

| Layer | Technology | Version |
|-------|-----------|---------|
| JavaScript/TS | TypeScript | 5.9.2 |
| React | React Native | 0.83.4 |
| Framework | Expo | 55.0 |
| Routing | expo-router | 55.0 |
| State | Redux Toolkit | 2.8.0 |
| Testing | Jest + jest-expo | 29.7 / 55.0 |
| Kotlin | Kotlin | 2.1.20 |
| Compiler | KSP | 2.1.20-2.0.1 |
| Database | Room | 2.7.1 |
| Encryption | SQLCipher | 4.5.4 |
| Sync | Nearby API | 19.3.0 |
| Background | WorkManager | 2.10.0 |
| Build | Gradle | 9.0 |

### Feature-First Architecture

```
src/
├── app/                    # expo-router routes
│   ├── (tabs)/
│   │   ├── index.tsx       # Session home
│   │   ├── devices.tsx     # Cross-tablet devices
│   │   ├── members.tsx     # Member list
│   │   ├── todos.tsx       # Sync test todos
│   │   └── weigh.tsx       # Weight measurement
│   └── login.tsx           # Auth entry point
│
├── features/               # Feature modules (7)
│   ├── auth/               # JWT login, token management
│   ├── session/            # Group session lifecycle
│   ├── member/             # NFC identification
│   ├── devices/            # Cross-tablet sync
│   ├── sync/               # Outbox status
│   ├── todo/               # CRUD + sync testing
│   └── weigh/              # Weight recording
│
├── components/             # Shared UI
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   ├── animated-icon.tsx
│   └── ui/collapsible.tsx
│
├── hooks/                  # Shared hooks
│   ├── useStore.ts         # Redux typed hooks
│   └── use-theme.ts        # Theme selection
│
├── constants/
│   └── theme.ts            # Colors, fonts, spacing
│
└── store/
    └── index.ts            # Redux store setup
```

### Event Types (10 Total)

All state changes recorded as immutable events:

```typescript
SessionStarted | SessionEnded
MemberRegistered | MemberIdentified
PaymentRecorded
WeightRecorded
AwardGranted
TodoCreated | TodoUpdated | TodoDeleted
```

Each event includes:
- `eventId` (UUID)
- `deviceId` (tablet identifier)
- `sessionId` (group session)
- `payload` (event-specific data)
- `idempotencyKey` (deduplication)
- `correlationId` (tracing)

### Outbox Pattern

All events flow through a reliable outbox:

```
Pending → DeviceSynced → BackendSynced
         ↓
      Failed (retry with exponential backoff)
```

## 📦 Available Scripts

```bash
# pnpm workspace commands
pnpm install              # Install all dependencies
pnpm test                 # Run all tests (99 total)
pnpm lint                 # Run TypeScript check
pnpm build                # Build all workspaces

# Expo app commands
cd apps/mobile

npx expo start            # Start dev server
npx expo run:android      # Build + run on Android
npx expo prebuild         # Generate native project
npx jest                  # Run mobile tests

# DataSync module (native development)
cd packages/datasync

# Build only datasync module
cd android && ./gradlew assembleDebug

# Full Android build
cd apps/mobile/android && ./gradlew assembleDebug
```

## 🔐 Security

- **SQLCipher**: All data encrypted at rest with 256-bit AES
- **Android Keystore**: Encryption key stored in secure hardware keystore
- **JWT Auth**: SecureStore token management, refresh token rotation
- **Event Integrity**: Idempotency keys prevent duplicate processing
- **Cross-Tablet Auth**: Device certificates for Nearby connection handshake

## 🎨 UI Components

Shared component library in `packages/ui/`:

- **Button** — Primary, secondary, danger, ghost variants
- **Card** — Container with shadow/elevation
- **Input** — Text field with label, error state
- **Badge** — Status indicators (success, warning, error, info)
- **ListItem** — Pressable list items with icons
- **StatusIndicator** — Connection/sync status (connected, syncing, offline, error)
- **Spinner** — Loading indicator

All components support light/dark themes via `colorScheme` prop.

## 🤔 Common Tasks

### Add a New Feature

```bash
# Create feature directory
mkdir -p apps/mobile/src/features/my-feature/{screens,store,services,types}

# Follow feature-first pattern
# - screens/MyFeatureScreen.tsx
# - store/myFeatureSlice.ts
# - services/myFeatureService.ts
# - types/index.ts
```

### Run Tests

```bash
# All tests (99)
pnpm test

# Specific suite
cd apps/mobile && npx jest src/features/auth/store/__tests__/

# Watch mode
npx jest --watch
```

### Debug Native Module

```bash
# Set GRADLE_OPTS for verbose output
export GRADLE_OPTS="-Dorg.gradle.logging.level=debug"
cd apps/mobile/android && ./gradlew assembleDebug --info

# Or enable Kotlin compiler verbose output in build.gradle
kotlinOptions {
  freeCompilerArgs = ["-verbose"]
}
```

## 📋 Coding Standards

See `.github/instructions/` for complete style guides:

- **react-core.instructions.md** — Components, hooks, Redux patterns
- **react-typescript.instructions.md** — Type safety, generics
- **react-archiecture.instructions.md** — Feature-first layout
- **react-performance.instructions.md** — Performance, bundle optimization
- **react-testing-security.instructions.md** — Testing, OWASP Mobile Top 10
- **datasync.instructions.md** — Kotlin bridge, event model

### Key Principles

- ✅ Functional components only (no class components)
- ✅ `StyleSheet.create()` for all styles
- ✅ Proper TypeScript (no `any` without comment)
- ✅ Test coverage for thunks, hooks, critical paths
- ✅ `AsyncFunction("name") Coroutine { ... }` for suspend Kotlin calls
- ✅ Events as SSOT — never write to Room directly

## 🔧 Troubleshooting

### KSP Classpath Error

If you see `com.google.devtools.ksp plugin not found`:

```bash
# The config plugin (plugins/withKspPlugin.js) should auto-inject KSP
# If not, manually add to apps/mobile/android/build.gradle buildscript dependencies:

classpath('com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin:2.1.20-2.0.1')
classpath('org.jetbrains.kotlin:kotlin-serialization:2.1.20')
```

### Disk Space Issues

The build can use 3-5GB. If you hit "not enough space":

```bash
# Clean all build caches
cd apps/mobile/android && ./gradlew clean

# Remove old node_modules build artifacts
find node_modules -path "*/android/build" -type d -exec rm -rf {} + 2>/dev/null

# Restrict to arm64-v8a only (already configured in gradle.properties)
reactNativeArchitectures=arm64-v8a
```

### Room KSP Errors

If you see `unexpected jvm signature V`:

```
✓ Room 2.7.1 is required (not 2.6.1)
✓ Kotlin 2.1.20, KSP 2.1.20-2.0.1 are compatible
✓ Check packages/datasync/android/build.gradle:
  - apply plugin: 'com.google.devtools.ksp'
  - kspAndroid 'androidx.room:room-compiler:2.7.1'
```

## 📖 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [Redux Toolkit Guide](https://redux-toolkit.js.org/)
- [Room Database Guide](https://developer.android.com/training/data-storage/room)
- [Google Nearby Connections](https://developers.google.com/nearby/connections/overview)
- [Android Security Guide](https://developer.android.com/privacy-and-security)

## 📝 License

Proprietary — XPW2 Fitness Solutions

## 👥 Contributing

1. Read `.github/copilot-instructions.md` for project conventions
2. Check `.github/instructions/` for specific coding rules
3. Run tests before pushing: `pnpm test`
4. Use feature branches: `git checkout -b feat/description`
5. Commit messages: follow conventional commits format

## 🤖 GitHub Copilot Integration

This project is configured for GitHub Copilot with specialized agents:

- **Coding_Agent** — Component, hook, Redux implementation
- **Planning_Agent** — Feature breakdown and task planning
- **Review_Agent** — Code review, architecture audit
- **Testing_Agent** — Unit and integration test generation

See `.github/agents/` for agent configurations.

---

**Last Updated**: April 2026  
**Target Device**: Samsung S25 Ultra (arm64-v8a)  
**Build Status**: ✅ Android APK builds successfully (82MB, 3m 32s)
