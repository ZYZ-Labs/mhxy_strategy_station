import { Form, useNavigation } from "react-router";

import type { Category, DraftGuide } from "~/features/content/types";

export function GuideForm({
  categories,
  draft,
  error,
  submitLabel = "保存草稿",
}: {
  categories: Category[];
  draft?: DraftGuide;
  error?: string;
  submitLabel?: string;
}) {
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  return (
    <Form method="post" className="form-stack">
      {error ? <p className="form-error">{error}</p> : null}
      <label>
        <span>标题</span>
        <input
          name="title"
          required
          minLength={4}
          maxLength={80}
          defaultValue={draft?.title}
          placeholder="清楚说明这篇攻略解决什么问题"
        />
      </label>
      <label>
        <span>摘要</span>
        <textarea
          name="summary"
          required
          minLength={10}
          maxLength={240}
          rows={3}
          defaultValue={draft?.summary}
          placeholder="用一小段话说明适用场景、版本和核心结论"
        />
      </label>
      <div className="form-grid">
        <label>
          <span>分类</span>
          <select name="categoryId" defaultValue={draft?.categoryId ?? ""}>
            <option value="">未分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>标签</span>
          <input
            name="tags"
            maxLength={180}
            defaultValue={draft?.tags.join("，")}
            placeholder="多个标签用逗号分隔，最多 8 个"
          />
        </label>
      </div>
      <label>
        <span>正文（纯文本）</span>
        <textarea
          name="body"
          required
          minLength={50}
          maxLength={30_000}
          rows={22}
          defaultValue={draft?.body}
          placeholder="建议包含适用版本、前置条件、具体步骤、成本和注意事项。"
        />
      </label>
      <div className="form-actions">
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? "正在保存…" : submitLabel}
        </button>
        <span className="form-hint">保存不会直接发布，提交审核后由管理员人工终审。</span>
      </div>
    </Form>
  );
}
