# Zalo QR Panel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/zalo-qr-panel)

Extract IMEI and cookies from Zalo QR code.

## Features

- 🔐 User authentication (local storage)
- 📱 Generate Zalo QR codes
- 🔍 Real-time QR scan status
- 📊 Extract IMEI and cookies
- 📋 Copy to clipboard
- 💾 Download as text file
- 🌐 Deploy on Vercel

## Tech Stack

- **Frontend**: Next.js, React
- **Backend**: Next.js API Routes
- **QR Generation**: qrcode library
- **Storage**: LocalStorage (client), In-memory (server)

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/zalo-qr-panel.git
cd zalo-qr-panel

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
