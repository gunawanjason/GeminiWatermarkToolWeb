<div align="center">

# Gemini Watermark Remover

**Remove Gemini AI watermarks from images — entirely in your browser.**

No uploads. No servers. No tracking. Your images never leave your device.

[![License: MIT](https://img.shields.io/badge/License-MIT-6B9080.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Astro](https://img.shields.io/badge/Astro-5.x-FF5D01?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

[Get Started](#-getting-started) · [How It Works](#-how-it-works) · [Features](#-features) · [Architecture](#-architecture)

</div>

---

## Overview

Gemini Watermark Remover is a client-side web application that strips the invisible watermarks embedded by Google's Gemini AI image generator. Using a faithful port of the reverse alpha blending algorithm from [GeminiWatermarkTool](https://github.com/allenk/GeminiWatermarkTool), it recovers the original pixel values — pixel by pixel — right in your browser.

**Key principle:** Every operation runs locally. No image data is ever transmitted over the network. The processing happens on a hidden `<canvas>` element using the Canvas API, and results are stored in IndexedDB for later access.

---

## Features

### Core

- **Single Image Processing** — Drop or upload one image and instantly get the clean version with a side-by-side comparison view
- **Batch Processing** — Upload dozens of images at once; they're processed sequentially with a live progress indicator
- **Processing History** — Every processed image is automatically saved to IndexedDB so you can revisit, compare, or re-download anytime
- **ZIP Downloads** — Download all processed images from batch or history as a single compressed `.zip` archive

### Privacy & Performance

- **100% Client-Side** — No server, no API, no cloud. Pure browser computation
- **Zero Network Requests** — Image data never leaves the device. Verified by design
- **Instant Processing** — Typical images process in under a second on modern hardware
- **Offline Capable** — Works without an internet connection after initial page load

### User Interface

- **Drag & Drop** — Drop images directly onto the upload zone or click to browse
- **Side-by-Side Comparison** — View original and processed images next to each other
- **Full-Screen Zoom** — Inspect results in a modal with original/clean toggle
- **Keyboard Shortcuts** — `⌘S` / `Ctrl+S` to save, `Esc` to close modals
- **Responsive Design** — Mobile-first with a fixed bottom navigation bar on small screens
- **Toast Notifications** — Non-intrusive feedback for all operations
- **Animated Transitions** — Smooth micro-interactions throughout the interface

---

## How It Works

Gemini's image generator embeds a watermark by blending a white logo pattern into the bottom-right corner of each generated image using alpha compositing:

```
watermarked_pixel = α × logo_value + (1 - α) × original_pixel
```

Where `α` is a per-pixel opacity value stored in a calibrated mask, and `logo_value` is `255.0` (white).

This tool reverses that operation by solving for the original pixel:

```
original_pixel = (watermarked_pixel - α × 255.0) / (1 - α)
```

### Watermark Sizes

The tool automatically detects the correct watermark size based on image dimensions:

| Condition | Watermark Size | Mask Dimensions | Margin |
|---|---|---|---|
| Either dimension ≤ 1024px | Small | 48 × 48 px | 32 px |
| Both dimensions > 1024px | Large | 96 × 96 px | 64 px |

The alpha masks are embedded as base64-encoded PNGs and decoded at runtime. Each pixel's alpha value is calculated as `max(R, G, B) / 255` from the mask image.

---

## Architecture

```
src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx          # Variant-based button (CVA)
│   │   ├── Card.tsx             # Composable card components
│   │   ├── ProgressBar.tsx      # Animated progress indicator
│   │   ├── Tabs.tsx             # Context-driven tab system
│   │   └── Toast.tsx            # Toast notification system
│   ├── WatermarkRemover.tsx     # Single image processing view
│   ├── BatchProcessor.tsx       # Batch processing with grid view
│   ├── HistoryView.tsx          # IndexedDB-backed history list
│   ├── Header.astro             # Top bar + mobile bottom nav
│   └── Footer.astro             # Footer with attribution
├── lib/
│   ├── watermark.ts             # Core reverse alpha blending algorithm
│   ├── masks.ts                 # Embedded PNG masks + alpha map decoder
│   ├── storage.ts               # IndexedDB wrapper (via idb)
│   ├── zip.ts                   # ZIP creation (via JSZip)
│   ├── analytics.ts             # GA4 event tracking module
│   ├── types.ts                 # Shared TypeScript interfaces
│   └── utils.ts                 # cn() utility (clsx + tailwind-merge)
├── layouts/
│   └── Layout.astro             # Root HTML shell, fonts, GA setup
├── pages/
│   ├── index.astro              # Single mode route
│   ├── batch.astro              # Batch mode route
│   └── history.astro            # History route
└── styles/
    └── global.css               # Tailwind v4 imports + custom animations
```

### Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Framework | [Astro 5](https://astro.build) | Static site generation, view transitions |
| UI | [React 19](https://react.dev) | Interactive components (hydrated with `client:load`) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) | Utility-first styling, custom theme tokens |
| Icons | [Lucide React](https://lucide.dev) | Consistent icon system |
| Storage | [idb](https://github.com/jakearchibald/idb) | Promise-based IndexedDB wrapper |
| Archives | [JSZip](https://stuk.github.io/jszip/) | Client-side ZIP file creation |
| Variants | [CVA](https://cva.style/) | Type-safe component variant styling |

### Design System

The UI is built on a warm, earthy color palette defined as CSS custom properties:

- **Background** — `#FAF9F6` (warm white)
- **Primary** — `#6B9080` (sage green)
- **Accent** — `#F4ECE4` (cream)
- **Typography** — Outfit (headings) + Inter (body)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+ 
- [pnpm](https://pnpm.io) (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/gunawanjason/GeminiWatermarkToolWeb.git
cd GeminiWatermarkToolWeb

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

The app runs at `http://localhost:4321`.

### Build for Production

```bash
pnpm build
```

Output is generated in the `dist/` directory as static HTML/JS/CSS. Deploy to any static host.

Preview the production build locally:

```bash
pnpm preview
```

---

## Usage

### Single Mode

1. Open the app — you're on the **Single** tab by default
2. Drag an image onto the upload zone or click to browse
3. Processing starts automatically; a progress indicator shows the status
4. Once complete, view the side-by-side comparison
5. Click **Download PNG** or press `⌘S` to save the clean image

### Batch Mode

1. Navigate to the **Batch** tab
2. Drag multiple images or click to browse (select multiple files)
3. Images are processed automatically with a live progress bar
4. Click **ZIP** to download all processed images as a single archive
5. Use the select checkboxes to manage individual items

### History

1. Navigate to the **History** tab
2. All previously processed images are listed with timestamps
3. Hover/hold the **Compare** button to toggle the original view
4. Download individually or use **Download All** for a ZIP

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 measurement ID | `G-0VYTHHEH0J` |

Analytics are automatically disabled in development mode.

---

## Credits & Attribution

- **Developed by** [Blessings Development](https://github.com/gunawanjason)
- **Original algorithm** by [Allen Kuo (allenk)](https://github.com/allenk) — [GeminiWatermarkTool](https://github.com/allenk/GeminiWatermarkTool)
- **Calibrated masks** sourced from the [GeminiRef](https://github.com/allenk/GeminiWatermarkTool) project

## License

This project is open source under the [MIT License](LICENSE).
