# Gemini Watermark Remover

A powerful, privacy-focused web application for removing watermarks from images directly in your browser. This tool utilizes advanced alpha mask extraction techniques to clean images efficiently without sending your data to the cloud.

## ✨ Features

- **Advanced Watermark Removal**: Faithfully ported algorithm from the original GeminiRef project, ensuring high-quality restoration.
- **Batch Processing**: Process multiple images simultaneously and download them as a ZIP archive.
- **Local History**: Your processed images are saved locally using IndexedDB, so you can revisit them anytime.
- **Privacy First**: All processing happens client-side. No images are ever uploaded to a server.
- **Modern UI**: Built with a responsive, clean interface using Tailwind CSS v4.

## 🛠️ Tech Stack

- **Framework**: [Astro](https://astro.build)
- **UI Library**: [React 19](https://react.dev)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **State/Storage**: IndexedDB (via `idb`)

## 🚀 Getting Started

1.  **Clone the repository**

    ```bash
    git clone https://github.com/gunawanjason/GeminiWatermarkToolWeb.git
    cd GeminiWatermarkToolWeb
    ```

2.  **Install dependencies**

    ```bash
    pnpm install
    ```

3.  **Start the development server**

    ```bash
    pnpm dev
    ```

    The app will run at `http://localhost:4321`.

## 🏗️ Building for Production

To create a production build:

```bash
pnpm build
```

You can preview the build locally with:

```bash
pnpm preview
```

## 👥 Credits & Attribution

- **Developed by**: Blessings Development
- **Original Core Algorithm**: Based on the work of [Allen Kuo (allenk)](https://github.com/allenk)

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
