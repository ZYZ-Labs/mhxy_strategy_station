import { Link, NavLink, Outlet } from "react-router";

import { getCurrentUser } from "~/features/auth/service.server";
import { getRegistrationAvailability } from "~/features/registration/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";

import type { Route } from "./+types/site-layout";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  const [user, registration] = await Promise.all([
    getCurrentUser(env.DB, request),
    getRegistrationAvailability(env.DB),
  ]);
  return { user, registration };
}

export default function SiteLayout({ loaderData }: Route.ComponentProps) {
  const { user, registration } = loaderData;
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-mark">策</span>
          <span>
            <strong>梦幻策略站</strong>
            <small>人工甄选 · AI 可读</small>
          </span>
        </Link>
        <nav aria-label="主导航">
          <NavLink to="/guides">攻略库</NavLink>
          <NavLink to="/search">搜索</NavLink>
          <NavLink to="/rules">发布规则</NavLink>
          {user ? <NavLink to="/dashboard">创作中心</NavLink> : null}
          {user?.role === "admin" || user?.role === "super_admin" ? (
            <NavLink to="/admin/reviews">审核后台</NavLink>
          ) : null}
        </nav>
        <div className="header-account">
          {user ? (
            <>
              <span>{user.displayName}</span>
              <form action="/logout" method="post">
                <button className="link-button" type="submit">
                  退出
                </button>
              </form>
            </>
          ) : (
            <>
              <Link to="/login">登录</Link>
              <Link className="button button-small" to="/register">
                {registration.mode === "open" ? "开放注册" : "邀请注册"}
              </Link>
            </>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div>
          <strong>梦幻策略站</strong>
          <p>只收录经过人工审核的纯文本攻略，为玩家和 AI 提供可追溯的高质量信息。</p>
        </div>
        <div className="footer-links">
          <Link to="/rules">发布规则</Link>
          <Link to="/guides">攻略库</Link>
          <a href="/mcp">MCP Endpoint</a>
        </div>
      </footer>
    </div>
  );
}
