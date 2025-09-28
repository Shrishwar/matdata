# Matka-Style Entertainment Number Guessing Platform (Frontend)

A modern web application for managing and predicting Matka-style number games. This frontend is built with React, TypeScript, Vite, and TailwindCSS.

## Features

- **Dashboard**: View top number predictions with confidence scores
- **History**: Browse past results with pagination
- **Admin Panel**: Add new results (admin only)
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode**: Built-in dark theme support
- **Secure Authentication**: JWT-based admin authentication

## Prerequisites

- Node.js 18+ and npm 9+
- Backend API server (see [backend README](../backend/README.md) for setup)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/matka-platform.git
   cd matka-platform/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the frontend directory:
   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev`: Start the development server
- `npm run build`: Build the application for production
- `npm run preview`: Preview the production build locally
- `npm run lint`: Run ESLint
- `npm run format`: Format code with Prettier

## Project Structure

```
src/
├── assets/          # Static assets
├── components/      # Reusable UI components
├── context/         # React context providers
├── hooks/           # Custom React hooks
├── layouts/         # Layout components
├── lib/             # Utility functions and API clients
├── pages/           # Page components
│   ├── AddResultPage.tsx
│   ├── HistoryPage.tsx
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   └── NotFoundPage.tsx
├── styles/          # Global styles
└── types/           # TypeScript type definitions
```

## Technologies Used

- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- [React Router](https://reactrouter.com/)
- [Recharts](https://recharts.org/)
- [Heroicons](https://heroicons.com/)
- [Headless UI](https://headlessui.com/)
- [date-fns](https://date-fns.org/)
- [Axios](https://axios-http.com/)

## License

MIT
