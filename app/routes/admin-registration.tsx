import { Form, useNavigation } from "react-router";

import { requireSuperAdmin } from "~/features/auth/service.server";
import { listRegistrationSchedules } from "~/features/registration/repository.server";
import {
  changeRegistrationSettings,
  createRegistrationSchedule,
  getRegistrationAvailability,
  toggleRegistrationSchedule,
} from "~/features/registration/service.server";
import { getCloudflare } from "~/lib/cloudflare.server";
import { checked, errorMessage, text } from "~/lib/forms.server";

import type { Route } from "./+types/admin-registration";

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = getCloudflare(context);
  await requireSuperAdmin(env.DB, request);
  return {
    availability: await getRegistrationAvailability(env.DB),
    schedules: await listRegistrationSchedules(env.DB),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = getCloudflare(context);
  const actor = await requireSuperAdmin(env.DB, request);
  const form = await request.formData();
  const intent = text(form, "intent");
  try {
    if (intent === "settings") {
      const manualMode = text(form, "manualMode");
      if (manualMode !== "open" && manualMode !== "invite_only") return { error: "注册模式无效" };
      await changeRegistrationSettings(env.DB, { actorId: actor.id, manualMode, thresholdStep: Number(text(form, "thresholdStep")) });
    } else if (intent === "one_time") {
      await createRegistrationSchedule(env.DB, {
        actorId: actor.id, name: text(form, "name"), scheduleType: "one_time",
        startsAt: text(form, "startsAt"), endsAt: text(form, "endsAt"),
        thresholdGuard: checked(form, "thresholdGuard"),
      });
    } else if (intent === "weekly") {
      await createRegistrationSchedule(env.DB, {
        actorId: actor.id, name: text(form, "name"), scheduleType: "weekly",
        weekdays: form.getAll("weekdays").map(Number),
        localStartTime: text(form, "localStartTime"), localEndTime: text(form, "localEndTime"),
        thresholdGuard: checked(form, "thresholdGuard"),
      });
    } else if (intent === "toggle") {
      await toggleRegistrationSchedule(env.DB, text(form, "scheduleId"), text(form, "enabled") === "true", actor.id);
    } else return { error: "操作类型无效" };
    return { success: "注册策略已更新" };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function AdminRegistration({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state === "submitting";
  const { availability } = loaderData;
  return <section className="dashboard-shell"><header className="page-heading"><p className="eyebrow">SUPER ADMIN ONLY</p><h1>注册策略</h1><p>当前：{availability.mode === "open" ? "开放注册" : "邀请码注册"}；非超管 {availability.nonSuperUserCount} 人；下一阈值 {availability.nextThreshold} 人。时区固定为 Asia/Shanghai。</p></header>
    {actionData?.error ? <p className="form-error">{actionData.error}</p> : null}{actionData?.success ? <p className="form-success">{actionData.success}</p> : null}
    <div className="dashboard-grid">
      <div className="panel"><h2>基础策略</h2><Form method="post" className="form-stack"><input type="hidden" name="intent" value="settings" /><label><span>手动模式</span><select name="manualMode" defaultValue={availability.mode}><option value="open">开放注册</option><option value="invite_only">邀请码注册</option></select></label><label><span>每新增多少人触发阈值</span><input name="thresholdStep" type="number" min={10} max={100000} defaultValue={availability.thresholdStep} required /></label><button className="button button-primary" disabled={busy} type="submit">保存并从当前人数计算下一阈值</button></Form></div>
      <div className="panel"><h2>一次性开放窗口</h2><Form method="post" className="form-stack"><input type="hidden" name="intent" value="one_time" /><label><span>计划名称</span><input name="name" required /></label><label><span>开始时间</span><input name="startsAt" type="datetime-local" required /></label><label><span>结束时间</span><input name="endsAt" type="datetime-local" required /></label><label><span><input name="thresholdGuard" type="checkbox" /> 达到人数阈值时提前关闭</span></label><button className="button button-primary" disabled={busy} type="submit">创建窗口</button></Form></div>
      <div className="panel"><h2>每周开放窗口</h2><Form method="post" className="form-stack"><input type="hidden" name="intent" value="weekly" /><label><span>计划名称</span><input name="name" required /></label><div className="tag-row">{weekdayLabels.map((label, day) => <label className="tag" key={day}><input name="weekdays" type="checkbox" value={day} /> 周{label}</label>)}</div><div className="form-grid"><label><span>开始</span><input name="localStartTime" type="time" required /></label><label><span>结束</span><input name="localEndTime" type="time" required /></label></div><label><span><input name="thresholdGuard" type="checkbox" /> 达到人数阈值时提前关闭</span></label><button className="button button-primary" disabled={busy} type="submit">创建每周计划</button></Form></div>
      <div className="panel"><h2>已有计划</h2>{loaderData.schedules.length ? loaderData.schedules.map((schedule) => <div className="status-row" key={schedule.id}><div><strong>{schedule.name}</strong><br /><small>{schedule.scheduleType === "one_time" ? `${schedule.startsAt} → ${schedule.endsAt}` : `周${schedule.weekdays.map((day) => weekdayLabels[day]).join("、")} ${schedule.localStartTime}–${schedule.localEndTime}`} · {schedule.thresholdGuard ? "受阈值约束" : "忽略阈值"}</small></div><Form method="post"><input type="hidden" name="intent" value="toggle" /><input type="hidden" name="scheduleId" value={schedule.id} /><input type="hidden" name="enabled" value={schedule.enabled ? "false" : "true"} /><button className="button button-small" type="submit">{schedule.enabled ? "停用" : "启用"}</button></Form></div>) : <p>暂无定时计划。</p>}</div>
    </div>
  </section>;
}
