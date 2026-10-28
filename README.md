# OrbitChat ⚡

> A quiet, terminal-adjacent, real-time chat tool with permanent handle reservation, SQLite persistence, and zero registration.

OrbitChat is an open-source real-time broadcast and chat workspace designed for people who appreciate quiet, high-density, taste-driven interfaces. No bloated registration flows, no passwords, no colorful balloon avatars, and no speech bubbles.

---

## ✨ Features

- **Permanent Handle Reservation**: Claim any handle from 1 to 20 characters (letters, numbers, symbols, spaces, and emojis). Once claimed in SQLite, it is permanently locked.
- **Zero Registration / Device-Bound Auth**: No passwords or email signups. The client stores a cryptographic private token in `localStorage` for transparent auto-login on return visits.
- **Cross-Device Private Key**: A one-click copyable private key allows you to authenticate your handle on mobile or another browser.
- **Real-Time Log Stream**: Instant bidirectional messaging via Socket.io. Messages are rendered in a clean, terminal-adjacent engineering log with message grouping for consecutive transmissions.
- **Left-Gutter Own Message Marker**: Own messages remain left-aligned and are distinguished with a sharp `2px solid #C6FF3D` acid-lime left edge.
- **Local SQLite Persistence**: Uses Node.js's native `node:sqlite` engine. Zero external native compilation or C++ build tools required.
- **Tasteful Dark System**:
  - Elevation by surface lightness tiers (`#0B0B0C` → `#111113` → `#17171A`).
  - Single intentional accent: acid lime (`#C6FF3D`).
  - 2.5% subtle grain overlay on background.
  - Square monogram tiles (JetBrains Mono) with desaturated tints.
  - Inline 1.5px geometric SVGs replacing all emoji UI icons.
  - Terminal-style typing indicator (`[user] is typing ▋`).
  - In-browser synthesized audio cues via the Web Audio API.

---

## 🚀 Quick Start

### Prerequisites
- Node.js **v22.5.0** or later (Node.js v24 recommended for built-in `node:sqlite`).

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/orbitchat.git
cd orbitchat

# Install dependencies
npm install

# Start the server
npm start
```

Open `http://localhost:3000` in your browser.

---

## 🧪 Running Unit Tests

OrbitChat includes automated test coverage for handle claiming, duplicate rejections, strict casing, length bounds, and SQLite message persistence:

```bash
node test_app.js
```

---

## 🌐 Instant Public Tunnel (Cloudflare)

To expose your local instance to a secure, public HTTPS link without port forwarding:

```bash
# Download cloudflared or use your package manager
cloudflared tunnel --url http://localhost:3000
```

---

## 📄 License

MIT License. Feel free to fork, adapt, and build upon it!
