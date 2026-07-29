import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./styles/app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f5f2ea" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "出现错误";
  let message = "请求未能完成，请稍后重试。";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "页面不存在" : `请求错误 ${error.status}`;
    message =
      error.status === 404
        ? "这个页面可能已经移动，或从未存在。"
        : error.statusText || message;
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
  }

  return (
    <main className="error-shell">
      <p className="eyebrow">梦幻西游攻略站</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <a className="button button-primary" href="/">
        返回首页
      </a>
    </main>
  );
}
