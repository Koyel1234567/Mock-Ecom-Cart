# Code development process

Use this in the terminal to create the project of vite.

- npx create-react-app vibe-commerce-cart
- cd vibe-commerce-cart

Install firebase for app datebase

- npm install firebase lucide-react

Then change the App.jsx , index.html and main.jsx to the given code.Run it using the command

- npm run dev

The website should be working on http://localhost:5173/ a local host as this does not use hosting


# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules. Used vite as it is the fastest and latest node setup.
 
Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
