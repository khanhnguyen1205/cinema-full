# GĐ2a — Nền Design-System (Kinetic Cinematic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng nền design-system cho bản redesign Kinetic Cinematic — self-host font, hệ token đầy đủ, bộ component `ui/` (primitive + kinetic) có test, và route dev `/kitchen-sink` — mà KHÔNG đổi layout các trang hiện có.

**Architecture:** Thêm token (CSS custom properties) theo lối *bổ sung* (không đổi giá trị token màu cũ để trang cũ giữ nguyên diện mạo). Component đặt ở `src/components/ui/`, mỗi file một trách nhiệm, chia sẻ một `ui.css`. Logic thuần và hành vi component được kiểm bằng Vitest + jsdom + Testing Library; phần CSS/token verify bằng gate CI + ảnh `/kitchen-sink`.

**Tech Stack:** React 18 + TypeScript 5.7 (strict), Vite 6, Vitest 3 (+ jsdom, @testing-library/react), ESLint 9 flat, Prettier, @fontsource, plain CSS.

## Global Constraints

- Node 22, Vite 6, TypeScript `~5.7` strict — không nâng major.
- Absolute imports qua alias/paths (`components/…`, `lib/…`); sibling cùng thư mục dùng `./`.
- Mọi commit giữ **6 gate xanh**: `npm run typecheck`, `npm run lint` (0 warning), `npm run format:check`, `npm run test:run`, `npm run e2e`, `npm run build`.
- **KHÔNG đổi giá trị các token màu đang tồn tại** (`--bg`, `--red`, `--text`, …) — chỉ thêm token mới, để các trang cũ giữ nguyên diện mạo trong 2a.
- Mọi animation phải có nhánh `@media (prefers-reduced-motion: reduce)`.
- Không dùng `any` (ESLint `@typescript-eslint/no-explicit-any` = error). CSS custom property trong `style` dùng kiểu `CSSProperties & Record<string, string>`.
- UI copy tiếng Việt.
- **KHÔNG** sửa/commit `CLAUDE.md` và `README.md` (để lát 2h, cần người dùng đồng ý).
- Commit mỗi task; push thẳng `main` khi kết thúc lát (repo cá nhân, không nhánh phụ).

## File Structure

- `src/styles/fonts.ts` — điểm import các gói @fontsource (self-host).
- `src/styles/tokens.css` — toàn bộ design token (mới + giữ nguyên giá trị cũ đã có ở global.css sẽ được chuyển vào đây nguyên vẹn).
- `src/styles/utilities.css` — utility class mới (container, stack, khối bone, mép ticket…).
- `src/styles/global.css` — `@import` tokens/utilities ở đầu; phần rule cũ giữ nguyên.
- `src/lib/cx.ts` — helper nối className (pure).
- `src/lib/cx.test.ts` — test cho cx.
- `src/test/setup.ts` — setup Vitest (jest-dom matchers + cleanup).
- `src/components/ui/ui.css` — CSS dùng chung cho toàn bộ component ui.
- `src/components/ui/Button.tsx` + `Tag.tsx` + `Badge.tsx` + `Card.tsx` + `Rule.tsx` + `Field.tsx` + `Skeleton.tsx` + `Spinner.tsx` + `IconButton.tsx` + `Modal.tsx` — primitive.
- `src/components/ui/Marquee.tsx` + `Reveal.tsx` + `TicketEdge.tsx` + `Numbered.tsx` + `KineticHeading.tsx` — primitive kinetic.
- `src/components/ui/Container.tsx` + `Section.tsx` + `Grid.tsx` — layout.
- `src/components/ui/index.ts` — barrel export.
- `src/components/ui/*.test.tsx` — test hành vi component.
- `src/pages/dev/KitchenSink.tsx` — trang preview (chỉ mount ở DEV).
- Sửa `src/App.tsx` — thêm route `/kitchen-sink` khi `import.meta.env.DEV`.
- Sửa `vite.config.mjs` — `test.environment: "jsdom"` + `setupFiles`.

---

### Task 1: Self-host font (bỏ CDN Google Fonts)

**Files:**
- Create: `src/styles/fonts.ts`
- Modify: `src/index.tsx` (thêm import fonts ở đầu)
- Modify: `src/styles/global.css:1` (xoá dòng `@import url("https://fonts.googleapis.com/...")`)

**Interfaces:**
- Produces: side-effect import `src/styles/fonts.ts` nạp Bebas Neue (400), Barlow (300/400/500/600/700), Space Mono (400/700).

- [ ] **Step 1: Cài các gói @fontsource**

```bash
npm install @fontsource/bebas-neue @fontsource/barlow @fontsource/space-mono
```

- [ ] **Step 2: Tạo `src/styles/fonts.ts`**

```ts
// Self-host font (thay CDN Google Fonts). Chỉ side-effect import.
import "@fontsource/bebas-neue/400.css";
import "@fontsource/barlow/300.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
```

- [ ] **Step 3: Import fonts ở đầu `src/index.tsx`**

Thêm dòng đầu tiên (trước `import "./styles/..."` nếu có, và trước import App):

```ts
import "./styles/fonts";
```

- [ ] **Step 4: Xoá `@import` Google Fonts khỏi `src/styles/global.css`**

Xoá nguyên dòng 1 (`@import url("https://fonts.googleapis.com/css2?...");`). Các `font-family` phía dưới giữ nguyên.

- [ ] **Step 5: Xác minh không còn URL Google Fonts và app build được**

Run: `grep -rn "fonts.googleapis.com" src/ ; echo "exit=$?"`
Expected: không có kết quả (grep exit=1).
Run: `npm run build`
Expected: build thành công.

- [ ] **Step 6: Chụp ảnh Home để xác nhận chữ vẫn render (self-host)**

```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"; [ -f "$CHROME" ] || CHROME="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"; "$CHROME" --headless --disable-gpu --window-size=1440,1000 --hide-scrollbars --screenshot="scratchpad-2a1-home.png" "http://localhost:3000/" 2>/dev/null; ls -la scratchpad-2a1-home.png
```
Expected: file ảnh tạo ra; chữ hiển thị đúng (Bebas ở tiêu đề). Xoá ảnh sau khi xem.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/styles/fonts.ts src/index.tsx src/styles/global.css
git commit -m "build(GD2a/1): self-host font qua @fontsource, bo CDN Google Fonts"
```

---

### Task 2: Hệ design token (tokens.css) + utilities.css

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/utilities.css`
- Modify: `src/styles/global.css` (thêm `@import` ở đầu; di chuyển khối `:root{}` màu cũ sang tokens.css)

**Interfaces:**
- Produces: token CSS custom properties dùng xuyên suốt (`--sp-*`, `--fs-*`, `--font-*`, `--r-*`, `--bw-*`, `--shadow-*`, `--dur-*`, `--ease-*`, `--z-*`, `--container-max`, `--gutter`, `--surface-invert`, …). Giá trị token màu cũ giữ **nguyên**.

- [ ] **Step 1: Tạo `src/styles/tokens.css`** (giữ nguyên giá trị màu cũ, thêm token mới)

```css
:root {
  /* ===== Màu (GIỮ NGUYÊN giá trị cũ) ===== */
  --bg: #0a0a0a;
  --bg-card: #111111;
  --bg-card2: #161616;
  --border: rgba(255, 255, 255, 0.07);
  --red: #e63030;
  --red-dark: #b52424;
  --red-glow: rgba(230, 48, 48, 0.3);
  --text: #f0f0f0;
  --text-muted: #888;
  --text-dim: #555;
  --accent: #e63030;

  /* ===== Màu bổ sung (kinetic) ===== */
  --surface: #111111;
  --surface-2: #161616;
  --surface-invert: #ece7dd; /* bone: khối đảo màu chữ đen */
  --text-invert: #0a0a0a;
  --border-strong: rgba(255, 255, 255, 0.22);
  --focus: #4c9aff;

  /* ===== Spacing (thang 4px) ===== */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 20px;
  --sp-6: 24px;
  --sp-8: 32px;
  --sp-10: 40px;
  --sp-12: 48px;
  --sp-16: 64px;
  --sp-20: 80px;
  --sp-24: 96px;

  /* ===== Typography ===== */
  --font-display: "Bebas Neue", sans-serif;
  --font-body: "Barlow", sans-serif;
  --font-mono: "Space Mono", monospace;
  --fs-label: 11px;
  --fs-sm: 13px;
  --fs-base: 15px;
  --fs-md: 18px;
  --fs-lg: 24px;
  --fs-xl: clamp(32px, 5vw, 56px);
  --fs-2xl: clamp(48px, 9vw, 120px);
  --fs-display: clamp(64px, 14vw, 200px);
  --tr-tight: -0.02em;
  --tr-wide: 0.15em;
  --tr-wider: 0.3em;

  /* ===== Radius / Border (brutalist: sắc) ===== */
  --r-0: 0px;
  --r-sm: 2px;
  --r-md: 4px;
  --bw-1: 1px;
  --bw-2: 2px;

  /* ===== Shadow ===== */
  --shadow-hard: 4px 4px 0 var(--red);
  --shadow-hard-dark: 4px 4px 0 rgba(0, 0, 0, 0.6);
  --shadow-soft: 0 20px 40px rgba(0, 0, 0, 0.6);

  /* ===== Motion ===== */
  --dur-fast: 120ms;
  --dur-base: 240ms;
  --dur-slow: 480ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* ===== Z-index ===== */
  --z-nav: 100;
  --z-dropdown: 200;
  --z-modal: 1000;
  --z-toast: 1100;

  /* ===== Layout ===== */
  --container-max: 1280px;
  --gutter: clamp(16px, 4vw, 48px);
}
```

- [ ] **Step 2: Tạo `src/styles/utilities.css`** (utility class mới)

```css
/* Container căn giữa theo token layout */
.u-container {
  width: 100%;
  max-width: var(--container-max);
  margin: 0 auto;
  padding-inline: var(--gutter);
}

/* Khối đảo màu "bone" (chữ đen nền ngà) */
.u-invert {
  background: var(--surface-invert);
  color: var(--text-invert);
}

/* Nhãn mono chữ hoa cỡ nhỏ */
.u-label {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: var(--tr-wide);
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Focus ring dùng chung */
.u-focus:focus-visible {
  outline: var(--bw-2) solid var(--focus);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Sửa `src/styles/global.css`** — thêm `@import` ở đầu, xoá khối `:root{}` màu cũ (đã chuyển sang tokens.css)

Ở đầu file (sau khi Task 1 đã xoá dòng Google Fonts), thêm:

```css
@import "./tokens.css";
@import "./utilities.css";
```

Rồi xoá khối `:root { --bg: ...; ... --accent: #e63030; }` cũ trong global.css (vì đã nằm trong tokens.css với giá trị y hệt).

- [ ] **Step 4: Xác minh gate + diện mạo trang cũ không đổi**

Run: `npm run build && npm run lint`
Expected: cả hai thành công (lint 0 warning).
Run: chụp Home như Task 1 Step 6 (đặt tên `scratchpad-2a2-home.png`).
Expected: diện mạo Home KHÔNG đổi so với trước (token màu giữ nguyên giá trị). Xoá ảnh sau khi xem.

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/styles/utilities.css src/styles/global.css
git commit -m "feat(GD2a/2): he design token day du + utilities (bo sung, khong doi mau cu)"
```

---

### Task 3: Hạ tầng test component (jsdom + Testing Library) + `cx` util

**Files:**
- Create: `src/lib/cx.ts`
- Create: `src/lib/cx.test.ts`
- Create: `src/test/setup.ts`
- Modify: `vite.config.mjs` (test.environment jsdom + setupFiles)

**Interfaces:**
- Produces: `cx(...parts: Array<string | false | null | undefined>): string` — nối các class truthy bằng khoảng trắng.

- [ ] **Step 1: Cài dependency test DOM**

```bash
npm install -D jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Viết test thất bại cho `cx`**

Create `src/lib/cx.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("nối các class truthy bằng khoảng trắng", () => {
    expect(cx("a", "b", "c")).toBe("a b c");
  });
  it("bỏ qua false/null/undefined/rỗng", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });
  it("không tham số -> chuỗi rỗng", () => {
    expect(cx()).toBe("");
  });
});
```

- [ ] **Step 3: Chạy để thấy fail**

Run: `npx vitest run src/lib/cx.test.ts`
Expected: FAIL (`Failed to resolve import "./cx"`).

- [ ] **Step 4: Cài đặt `cx`**

Create `src/lib/cx.ts`:

```ts
// Nối className: giữ phần truthy, bỏ false/null/undefined/rỗng.
export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
```

- [ ] **Step 5: Chạy để thấy pass**

Run: `npx vitest run src/lib/cx.test.ts`
Expected: PASS (3 test).

- [ ] **Step 6: Tạo setup Vitest**

Create `src/test/setup.ts`:

```ts
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Dọn DOM sau mỗi test (do dùng globals: false).
afterEach(() => cleanup());
```

- [ ] **Step 7: Bật jsdom + setupFiles trong `vite.config.mjs`**

Sửa khối `test`:

```js
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
```

- [ ] **Step 8: Chạy toàn bộ unit test (pricing + cx) dưới jsdom**

Run: `npm run test:run`
Expected: PASS (28 pricing + 3 cx = 31).

- [ ] **Step 9: typecheck + lint + commit**

Run: `npm run typecheck && npm run lint`
Expected: cả hai xanh.

```bash
git add package.json package-lock.json src/lib/cx.ts src/lib/cx.test.ts src/test/setup.ts vite.config.mjs
git commit -m "test(GD2a/3): ha tang test component (jsdom + testing-library) + cx util"
```

---

### Task 4: Component `Button`

**Files:**
- Create: `src/components/ui/ui.css`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Button.test.tsx`
- Create: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `cx` từ `lib/cx`.
- Produces: `Button` (default export). Props: `variant?: "solid"|"outline"|"ghost"|"invert"` (mặc định "solid"), `size?: "sm"|"md"|"lg"` (mặc định "md"), cùng mọi thuộc tính `<button>`. Class gốc: `ui-btn`, biến thể `ui-btn--<variant>`, cỡ `ui-btn--<size>`.

- [ ] **Step 1: Viết test thất bại**

Create `src/components/ui/Button.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "./Button";

describe("Button", () => {
  it("render với class biến thể & cỡ mặc định", () => {
    render(<Button>Đặt vé</Button>);
    const btn = screen.getByRole("button", { name: "Đặt vé" });
    expect(btn).toHaveClass("ui-btn", "ui-btn--solid", "ui-btn--md");
  });

  it("áp variant & size truyền vào", () => {
    render(
      <Button variant="outline" size="lg">
        X
      </Button>,
    );
    expect(screen.getByRole("button")).toHaveClass(
      "ui-btn--outline",
      "ui-btn--lg",
    );
  });

  it("gọi onClick khi bấm", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled thì không gọi onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx vitest run src/components/ui/Button.test.tsx`
Expected: FAIL (`Failed to resolve import "./Button"`).

- [ ] **Step 3: Tạo `ui.css` với style Button**

Create `src/components/ui/ui.css`:

```css
/* ===== Button ===== */
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: var(--tr-wide);
  text-transform: uppercase;
  border: var(--bw-2) solid transparent;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition:
    transform var(--dur-fast) var(--ease-out),
    background var(--dur-fast),
    color var(--dur-fast),
    box-shadow var(--dur-fast);
}
.ui-btn:focus-visible {
  outline: var(--bw-2) solid var(--focus);
  outline-offset: 2px;
}
.ui-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ui-btn--sm {
  font-size: var(--fs-label);
  padding: var(--sp-2) var(--sp-3);
}
.ui-btn--md {
  font-size: var(--fs-sm);
  padding: var(--sp-3) var(--sp-5);
}
.ui-btn--lg {
  font-size: var(--fs-base);
  padding: var(--sp-4) var(--sp-8);
}
.ui-btn--solid {
  background: var(--red);
  color: #fff;
}
.ui-btn--solid:not(:disabled):hover {
  background: var(--red-dark);
  box-shadow: var(--shadow-hard-dark);
  transform: translate(-2px, -2px);
}
.ui-btn--outline {
  background: transparent;
  color: var(--text);
  border-color: var(--border-strong);
}
.ui-btn--outline:not(:disabled):hover {
  border-color: var(--text);
}
.ui-btn--ghost {
  background: transparent;
  color: var(--text-muted);
}
.ui-btn--ghost:not(:disabled):hover {
  color: var(--text);
}
.ui-btn--invert {
  background: var(--surface-invert);
  color: var(--text-invert);
}
.ui-btn--invert:not(:disabled):hover {
  box-shadow: var(--shadow-hard);
  transform: translate(-2px, -2px);
}

@media (prefers-reduced-motion: reduce) {
  .ui-btn {
    transition: background var(--dur-fast), color var(--dur-fast);
  }
  .ui-btn:not(:disabled):hover {
    transform: none;
  }
}
```

- [ ] **Step 4: Tạo `Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

type Variant = "solid" | "outline" | "ghost" | "invert";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export default function Button({
  variant = "solid",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx("ui-btn", `ui-btn--${variant}`, `ui-btn--${size}`, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Tạo barrel `index.ts`**

```ts
export { default as Button } from "./Button";
```

- [ ] **Step 6: Chạy test + gate**

Run: `npx vitest run src/components/ui/Button.test.tsx`
Expected: PASS (4 test).
Run: `npm run typecheck && npm run lint`
Expected: xanh.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/
git commit -m "feat(GD2a/4): component Button (4 variant, 3 size) + test"
```

---

### Task 5: Primitive tĩnh — `Tag`, `Badge`, `Card`, `Rule`

**Files:**
- Create: `src/components/ui/Tag.tsx`, `Badge.tsx`, `Card.tsx`, `Rule.tsx`
- Create: `src/components/ui/StaticPrimitives.test.tsx`
- Modify: `src/components/ui/ui.css` (thêm style), `src/components/ui/index.ts` (export)

**Interfaces:**
- Produces:
  - `Tag` — props: `children: ReactNode`, `className?`. Class `ui-tag`.
  - `Badge` — props: `children: ReactNode`, `tone?: "red"|"muted"` (mặc định "red"), `className?`. Class `ui-badge`, `ui-badge--<tone>`.
  - `Card` — props: `children: ReactNode`, `className?`, cùng `HTMLAttributes<HTMLDivElement>`. Class `ui-card`.
  - `Rule` — props: `className?`. Render `<hr>` class `ui-rule`.

- [ ] **Step 1: Viết test thất bại**

Create `src/components/ui/StaticPrimitives.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tag, Badge, Card, Rule } from "./index";

describe("primitive tĩnh", () => {
  it("Tag render nội dung + class", () => {
    render(<Tag>Mới</Tag>);
    expect(screen.getByText("Mới")).toHaveClass("ui-tag");
  });
  it("Badge áp tone", () => {
    render(<Badge tone="muted">8.4</Badge>);
    expect(screen.getByText("8.4")).toHaveClass("ui-badge", "ui-badge--muted");
  });
  it("Card render children + class gốc", () => {
    render(<Card>nội dung</Card>);
    expect(screen.getByText("nội dung")).toHaveClass("ui-card");
  });
  it("Rule là hr có class", () => {
    const { container } = render(<Rule />);
    const hr = container.querySelector("hr");
    expect(hr).not.toBeNull();
    expect(hr).toHaveClass("ui-rule");
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx vitest run src/components/ui/StaticPrimitives.test.tsx`
Expected: FAIL (import Tag/Badge/Card/Rule chưa có).

- [ ] **Step 3: Thêm style vào `ui.css`**

Nối vào cuối `src/components/ui/ui.css`:

```css
/* ===== Tag ===== */
.ui-tag {
  display: inline-block;
  background: var(--red);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: var(--tr-wide);
  text-transform: uppercase;
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-sm);
}

/* ===== Badge ===== */
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  font-weight: 700;
  letter-spacing: var(--tr-wide);
  padding: var(--sp-1) var(--sp-2);
  border: var(--bw-1) solid var(--border-strong);
  border-radius: var(--r-sm);
}
.ui-badge--red {
  color: var(--red);
  border-color: var(--red);
}
.ui-badge--muted {
  color: var(--text-muted);
}

/* ===== Card ===== */
.ui-card {
  background: var(--surface);
  border: var(--bw-1) solid var(--border);
  border-radius: var(--r-sm);
}

/* ===== Rule ===== */
.ui-rule {
  border: 0;
  border-top: var(--bw-1) solid var(--border-strong);
  margin: 0;
}
```

- [ ] **Step 4: Tạo 4 file component**

`src/components/ui/Tag.tsx`:

```tsx
import type { ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Tag({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("ui-tag", className)}>{children}</span>;
}
```

`src/components/ui/Badge.tsx`:

```tsx
import type { ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Badge({
  children,
  tone = "red",
  className,
}: {
  children: ReactNode;
  tone?: "red" | "muted";
  className?: string;
}) {
  return (
    <span className={cx("ui-badge", `ui-badge--${tone}`, className)}>
      {children}
    </span>
  );
}
```

`src/components/ui/Card.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Card({ children, className, ...rest }: CardProps) {
  return (
    <div className={cx("ui-card", className)} {...rest}>
      {children}
    </div>
  );
}
```

`src/components/ui/Rule.tsx`:

```tsx
import { cx } from "lib/cx";
import "./ui.css";

export default function Rule({ className }: { className?: string }) {
  return <hr className={cx("ui-rule", className)} />;
}
```

- [ ] **Step 5: Export trong `index.ts`**

Thêm:

```ts
export { default as Tag } from "./Tag";
export { default as Badge } from "./Badge";
export { default as Card } from "./Card";
export { default as Rule } from "./Rule";
```

- [ ] **Step 6: Chạy test + gate**

Run: `npx vitest run src/components/ui/StaticPrimitives.test.tsx`
Expected: PASS (4 test).
Run: `npm run typecheck && npm run lint`
Expected: xanh.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/
git commit -m "feat(GD2a/5): primitive Tag/Badge/Card/Rule + test"
```

---

### Task 6: Field / Skeleton / Spinner / IconButton

**Files:**
- Create: `src/components/ui/Field.tsx`, `Skeleton.tsx`, `Spinner.tsx`, `IconButton.tsx`
- Create: `src/components/ui/FormPrimitives.test.tsx`
- Modify: `src/components/ui/ui.css`, `src/components/ui/index.ts`

**Interfaces:**
- Produces:
  - `Field` — props: `label?: string`, `htmlFor?: string`, `children: ReactNode`, `className?`. Render `<div class="ui-field">` chứa `<label class="ui-field__label">` (nếu có label) + children.
  - `Skeleton` — props: `width?: string`, `height?: string`, `className?`. Render `<div class="ui-skeleton" role="status" aria-label="Đang tải">` với inline `width/height`.
  - `Spinner` — props: `className?`. Render `<span class="ui-spinner" role="status" aria-label="Đang tải" />`.
  - `IconButton` — props: `label: string` (aria-label bắt buộc), `children: ReactNode`, cùng thuộc tính `<button>`. Class `ui-iconbtn`.

- [ ] **Step 1: Viết test thất bại**

Create `src/components/ui/FormPrimitives.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field, Skeleton, Spinner, IconButton } from "./index";

describe("form/feedback primitive", () => {
  it("Field hiển thị label và bọc children", () => {
    render(
      <Field label="Email">
        <input aria-label="email-input" />
      </Field>,
    );
    expect(screen.getByText("Email")).toHaveClass("ui-field__label");
    expect(screen.getByLabelText("email-input")).toBeInTheDocument();
  });

  it("Skeleton nhận width/height và có role status", () => {
    render(<Skeleton width="120px" height="20px" />);
    const el = screen.getByRole("status");
    expect(el).toHaveClass("ui-skeleton");
    expect(el).toHaveStyle({ width: "120px", height: "20px" });
  });

  it("Spinner có aria-label", () => {
    render(<Spinner />);
    expect(screen.getByLabelText("Đang tải")).toHaveClass("ui-spinner");
  });

  it("IconButton dùng label làm aria-label", () => {
    render(
      <IconButton label="Đóng">
        <span>×</span>
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Đóng" })).toHaveClass(
      "ui-iconbtn",
    );
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx vitest run src/components/ui/FormPrimitives.test.tsx`
Expected: FAIL (import chưa có).

- [ ] **Step 3: Thêm style vào `ui.css`**

Nối vào cuối `ui.css`:

```css
/* ===== Field ===== */
.ui-field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.ui-field__label {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: var(--tr-wide);
  text-transform: uppercase;
  color: var(--text-muted);
}

/* ===== Skeleton ===== */
.ui-skeleton {
  background: linear-gradient(
    90deg,
    var(--surface) 25%,
    var(--surface-2) 37%,
    var(--surface) 63%
  );
  background-size: 400% 100%;
  border-radius: var(--r-sm);
  animation: ui-skeleton-shimmer 1.4s ease infinite;
}
@keyframes ui-skeleton-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

/* ===== Spinner ===== */
.ui-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: var(--bw-2) solid var(--border-strong);
  border-top-color: var(--red);
  border-radius: 50%;
  animation: ui-spin 0.7s linear infinite;
}
@keyframes ui-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ===== IconButton ===== */
.ui-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  color: var(--text-muted);
  border: var(--bw-1) solid var(--border);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition:
    color var(--dur-fast),
    border-color var(--dur-fast);
}
.ui-iconbtn:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
.ui-iconbtn:focus-visible {
  outline: var(--bw-2) solid var(--focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .ui-skeleton {
    animation: none;
  }
  .ui-spinner {
    animation-duration: 1.4s;
  }
}
```

- [ ] **Step 4: Tạo 4 file component**

`src/components/ui/Field.tsx`:

```tsx
import type { ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ui-field", className)}>
      {label && (
        <label className="ui-field__label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
```

`src/components/ui/Skeleton.tsx`:

```tsx
import type { CSSProperties } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Skeleton({
  width = "100%",
  height = "1em",
  className,
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  const style: CSSProperties = { width, height };
  return (
    <div
      className={cx("ui-skeleton", className)}
      style={style}
      role="status"
      aria-label="Đang tải"
    />
  );
}
```

`src/components/ui/Spinner.tsx`:

```tsx
import { cx } from "lib/cx";
import "./ui.css";

export default function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("ui-spinner", className)}
      role="status"
      aria-label="Đang tải"
    />
  );
}
```

`src/components/ui/IconButton.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  children: ReactNode;
}

export default function IconButton({
  label,
  children,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      className={cx("ui-iconbtn", className)}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Export trong `index.ts`**

```ts
export { default as Field } from "./Field";
export { default as Skeleton } from "./Skeleton";
export { default as Spinner } from "./Spinner";
export { default as IconButton } from "./IconButton";
```

- [ ] **Step 6: Chạy test + gate**

Run: `npx vitest run src/components/ui/FormPrimitives.test.tsx`
Expected: PASS (4 test).
Run: `npm run typecheck && npm run lint`
Expected: xanh.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/
git commit -m "feat(GD2a/6): Field/Skeleton/Spinner/IconButton + test"
```

---

### Task 7: `Numbered` + `KineticHeading` (logic thuần)

**Files:**
- Create: `src/components/ui/Numbered.tsx`, `KineticHeading.tsx`
- Create: `src/components/ui/Numbered.test.tsx`, `KineticHeading.test.tsx`
- Modify: `src/components/ui/ui.css`, `src/components/ui/index.ts`

**Interfaces:**
- Produces:
  - `formatIndex(n: number): string` (named export từ `Numbered.tsx`) — `1 -> "N°01"`, `12 -> "N°12"`, `100 -> "N°100"`.
  - `Numbered` (default) — props: `n: number`, `className?`. Render `<span class="ui-numbered">` chứa `formatIndex(n)`.
  - `KineticHeading` (default) — props: `text: string`, `className?`. Render `<span class="ui-kinetic" aria-label={text}>` với mỗi ký tự là `<span class="ui-kinetic__ch" aria-hidden style="--i:i">` (khoảng trắng -> ` `).

- [ ] **Step 1: Viết test thất bại**

Create `src/components/ui/Numbered.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Numbered, { formatIndex } from "./Numbered";

describe("formatIndex", () => {
  it("đệm 0 tới 2 chữ số", () => {
    expect(formatIndex(1)).toBe("N°01");
    expect(formatIndex(12)).toBe("N°12");
  });
  it("số ≥100 giữ nguyên", () => {
    expect(formatIndex(100)).toBe("N°100");
  });
});

describe("Numbered", () => {
  it("render index đã định dạng", () => {
    render(<Numbered n={3} />);
    expect(screen.getByText("N°03")).toHaveClass("ui-numbered");
  });
});
```

Create `src/components/ui/KineticHeading.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import KineticHeading from "./KineticHeading";

describe("KineticHeading", () => {
  it("đặt aria-label = text và tách ký tự thành span", () => {
    const { container } = render(<KineticHeading text="AB C" />);
    const root = screen.getByLabelText("AB C");
    expect(root).toHaveClass("ui-kinetic");
    // 4 ký tự "A","B"," ","C"
    expect(container.querySelectorAll(".ui-kinetic__ch")).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx vitest run src/components/ui/Numbered.test.tsx src/components/ui/KineticHeading.test.tsx`
Expected: FAIL (import chưa có).

- [ ] **Step 3: Thêm style vào `ui.css`**

```css
/* ===== Numbered ===== */
.ui-numbered {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: var(--tr-wide);
  color: var(--red);
}

/* ===== KineticHeading ===== */
.ui-kinetic {
  font-family: var(--font-display);
  line-height: 0.9;
  display: inline-block;
}
.ui-kinetic__ch {
  display: inline-block;
  animation: ui-kinetic-in var(--dur-slow) var(--ease-out) both;
  animation-delay: calc(var(--i) * 40ms);
}
@keyframes ui-kinetic-in {
  from {
    opacity: 0;
    transform: translateY(0.4em);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ui-kinetic__ch {
    animation: none;
  }
}
```

- [ ] **Step 4: Tạo `Numbered.tsx`**

```tsx
import { cx } from "lib/cx";
import "./ui.css";

export function formatIndex(n: number): string {
  return `N°${String(n).padStart(2, "0")}`;
}

export default function Numbered({
  n,
  className,
}: {
  n: number;
  className?: string;
}) {
  return <span className={cx("ui-numbered", className)}>{formatIndex(n)}</span>;
}
```

- [ ] **Step 5: Tạo `KineticHeading.tsx`**

```tsx
import type { CSSProperties } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function KineticHeading({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={cx("ui-kinetic", className)} aria-label={text}>
      {Array.from(text).map((ch, i) => {
        const style: CSSProperties & Record<string, string> = {
          "--i": String(i),
        };
        return (
          <span
            key={i}
            aria-hidden="true"
            className="ui-kinetic__ch"
            style={style}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </span>
  );
}
```

- [ ] **Step 6: Export trong `index.ts`**

```ts
export { default as Numbered, formatIndex } from "./Numbered";
export { default as KineticHeading } from "./KineticHeading";
```

- [ ] **Step 7: Chạy test + gate**

Run: `npx vitest run src/components/ui/Numbered.test.tsx src/components/ui/KineticHeading.test.tsx`
Expected: PASS (3 + 1).
Run: `npm run typecheck && npm run lint`
Expected: xanh.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/
git commit -m "feat(GD2a/7): Numbered (formatIndex) + KineticHeading + test"
```

---

### Task 8: `Marquee` + `Reveal` + `TicketEdge` (kinetic có DOM/IO)

**Files:**
- Create: `src/components/ui/Marquee.tsx`, `Reveal.tsx`, `TicketEdge.tsx`
- Create: `src/components/ui/Marquee.test.tsx`, `Reveal.test.tsx`
- Modify: `src/components/ui/ui.css`, `src/components/ui/index.ts`

**Interfaces:**
- Produces:
  - `Marquee` — props: `children: ReactNode`, `speed?: number` (giây/lượt, mặc định 30), `className?`. Render `<div class="ui-marquee">` chứa `<div class="ui-marquee__track" style="--marquee-dur:<speed>s">` với **2** `.ui-marquee__group` (bản thứ 2 `aria-hidden`).
  - `Reveal` — props: `children: ReactNode`, `className?`. Bọc `<div class="ui-reveal">`, thêm class `is-visible` khi phần tử vào viewport (IntersectionObserver); nếu môi trường không có IO thì hiện ngay.
  - `TicketEdge` — props: `children: ReactNode`, `className?`. Render `<div class="ui-ticket">` (mép đục lỗ qua CSS).

- [ ] **Step 1: Viết test thất bại**

Create `src/components/ui/Marquee.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Marquee from "./Marquee";

describe("Marquee", () => {
  it("nhân đôi nội dung và đặt biến thời lượng", () => {
    const { container } = render(<Marquee speed={20}>PHIM MỚI</Marquee>);
    const groups = container.querySelectorAll(".ui-marquee__group");
    expect(groups).toHaveLength(2);
    // bản sao thứ 2 ẩn với trợ năng
    expect(groups[1].getAttribute("aria-hidden")).toBe("true");
    const track = container.querySelector(".ui-marquee__track");
    expect(track?.getAttribute("style")).toContain("--marquee-dur: 20s");
  });
});
```

Create `src/components/ui/Reveal.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import Reveal from "./Reveal";

// Điều khiển IntersectionObserver để test đường "vào viewport".
let triggers: Array<(entries: { isIntersecting: boolean }[]) => void>;

beforeEach(() => {
  triggers = [];
  class IO {
    cb: (entries: { isIntersecting: boolean }[]) => void;
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
      this.cb = cb;
      triggers.push(cb);
    }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", IO);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Reveal", () => {
  it("thêm is-visible khi phần tử vào viewport", () => {
    const { container } = render(<Reveal>nội dung</Reveal>);
    const el = container.querySelector(".ui-reveal");
    expect(el).not.toBeNull();
    expect(el).not.toHaveClass("is-visible");
    // kích hoạt intersection
    triggers[0]([{ isIntersecting: true }]);
    expect(container.querySelector(".ui-reveal")).toHaveClass("is-visible");
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx vitest run src/components/ui/Marquee.test.tsx src/components/ui/Reveal.test.tsx`
Expected: FAIL (import chưa có).

- [ ] **Step 3: Thêm style vào `ui.css`**

```css
/* ===== Marquee ===== */
.ui-marquee {
  overflow: hidden;
  white-space: nowrap;
}
.ui-marquee__track {
  display: inline-flex;
  animation: ui-marquee-scroll var(--marquee-dur, 30s) linear infinite;
}
.ui-marquee__group {
  display: inline-flex;
  flex-shrink: 0;
}
@keyframes ui-marquee-scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ui-marquee__track {
    animation: none;
  }
}

/* ===== Reveal ===== */
.ui-reveal {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity var(--dur-slow) var(--ease-out),
    transform var(--dur-slow) var(--ease-out);
}
.ui-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .ui-reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
}

/* ===== TicketEdge (mép đục lỗ) ===== */
.ui-ticket {
  position: relative;
  background: var(--surface);
  border: var(--bw-1) solid var(--border);
  border-radius: var(--r-sm);
  --punch: 12px;
  -webkit-mask:
    radial-gradient(
        var(--punch) at left center,
        transparent 98%,
        #000
      )
      left / 51% 100% no-repeat,
    radial-gradient(var(--punch) at right center, transparent 98%, #000) right /
      51% 100% no-repeat;
  mask:
    radial-gradient(var(--punch) at left center, transparent 98%, #000) left /
      51% 100% no-repeat,
    radial-gradient(var(--punch) at right center, transparent 98%, #000) right /
      51% 100% no-repeat;
}
```

- [ ] **Step 4: Tạo `Marquee.tsx`**

```tsx
import type { CSSProperties, ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Marquee({
  children,
  speed = 30,
  className,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const style: CSSProperties & Record<string, string> = {
    "--marquee-dur": `${speed}s`,
  };
  return (
    <div className={cx("ui-marquee", className)}>
      <div className="ui-marquee__track" style={style}>
        <div className="ui-marquee__group">{children}</div>
        <div className="ui-marquee__group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Tạo `Reveal.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cx("ui-reveal", shown && "is-visible", className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Tạo `TicketEdge.tsx`**

```tsx
import type { ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function TicketEdge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("ui-ticket", className)}>{children}</div>;
}
```

- [ ] **Step 7: Export trong `index.ts`**

```ts
export { default as Marquee } from "./Marquee";
export { default as Reveal } from "./Reveal";
export { default as TicketEdge } from "./TicketEdge";
```

- [ ] **Step 8: Chạy test + gate**

Run: `npx vitest run src/components/ui/Marquee.test.tsx src/components/ui/Reveal.test.tsx`
Expected: PASS (1 + 1).
Run: `npm run typecheck && npm run lint`
Expected: xanh.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/
git commit -m "feat(GD2a/8): kinetic Marquee/Reveal/TicketEdge + test"
```

---

### Task 9: `Modal` nâng lên `ui/` (giữ tương thích ngược)

**Files:**
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Modal.test.tsx`
- Modify: `src/components/admin/Modal.jsx` → chuyển thành re-export (giữ đường import cũ hoạt động)
- Modify: `src/components/ui/ui.css`, `src/components/ui/index.ts`

**Interfaces:**
- Produces: `Modal` (default) — props: `title: string`, `onClose: () => void`, `children: ReactNode`. Render overlay `<div class="ui-modal-overlay">` + `<div class="ui-modal" role="dialog" aria-modal="true" aria-label={title}>`; nút đóng dùng `IconButton` (label "Đóng"); bấm overlay hoặc nút gọi `onClose`.

- [ ] **Step 1: Đọc `src/components/admin/Modal.jsx` hiện tại**

Run: `cat src/components/admin/Modal.jsx`
Mục đích: nắm props hiện dùng (`title`, `onClose`, `children`) để `ui/Modal` tương thích. (Nếu props khác, cập nhật interface cho khớp trước khi viết test.)

- [ ] **Step 2: Viết test thất bại**

Create `src/components/ui/Modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "./Modal";

describe("Modal", () => {
  it("hiển thị title, role dialog, và children", () => {
    render(
      <Modal title="Sửa phim" onClose={() => {}}>
        <p>nội dung</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Sửa phim" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("nội dung")).toBeInTheDocument();
  });

  it("bấm nút Đóng gọi onClose", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="X" onClose={onClose}>
        <p>a</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Chạy để thấy fail**

Run: `npx vitest run src/components/ui/Modal.test.tsx`
Expected: FAIL (import chưa có).

- [ ] **Step 4: Thêm style Modal vào `ui.css`**

```css
/* ===== Modal ===== */
.ui-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-4);
}
.ui-modal {
  position: relative;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow: auto;
  background: var(--surface-2);
  border: var(--bw-1) solid var(--border-strong);
  border-radius: var(--r-sm);
  padding: var(--sp-6);
}
.ui-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  margin-bottom: var(--sp-4);
}
.ui-modal__title {
  font-family: var(--font-display);
  font-size: var(--fs-lg);
  letter-spacing: var(--tr-wide);
}
```

- [ ] **Step 5: Tạo `ui/Modal.tsx`**

```tsx
import type { ReactNode } from "react";
import IconButton from "./IconButton";
import "./ui.css";

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal__head">
          <h2 className="ui-modal__title">{title}</h2>
          <IconButton label="Đóng" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Export trong `index.ts`**

```ts
export { default as Modal } from "./Modal";
```

- [ ] **Step 7: Biến `admin/Modal.jsx` thành re-export**

Thay toàn bộ nội dung `src/components/admin/Modal.jsx` bằng:

```jsx
// Giữ đường import cũ; triển khai thật ở components/ui/Modal.
export { default } from "components/ui/Modal";
```

- [ ] **Step 8: Chạy test + gate (đảm bảo AdminMovies/Rooms/Showtimes vẫn dùng Modal được)**

Run: `npx vitest run src/components/ui/Modal.test.tsx`
Expected: PASS (2 test).
Run: `npm run typecheck && npm run lint && npm run build`
Expected: xanh (các trang admin import `components/admin/Modal` vẫn hoạt động qua re-export).

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/ src/components/admin/Modal.jsx
git commit -m "refactor(GD2a/9): nang Modal len ui/ (a11y dialog) + admin/Modal re-export"
```

---

### Task 10: Layout — `Container`, `Section`, `Grid`

**Files:**
- Create: `src/components/ui/Container.tsx`, `Section.tsx`, `Grid.tsx`
- Create: `src/components/ui/Layout.test.tsx`
- Modify: `src/components/ui/ui.css`, `src/components/ui/index.ts`

**Interfaces:**
- Produces:
  - `Container` — props: `children: ReactNode`, `className?`. Render `<div class="ui-container">` (dùng class utility `u-container` đã có + hook riêng). *(Dùng class `ui-container` riêng để không phụ thuộc utilities.css.)*
  - `Section` — props: `label?: string`, `index?: number`, `children: ReactNode`, `className?`. Render `<section class="ui-section">`; nếu có `label`/`index` thì hàng đầu là `<div class="ui-section__head">` gồm `Numbered` (khi có index) + `<span class="ui-section__label">` + `Rule`.
  - `Grid` — props: `children: ReactNode`, `min?: string` (bề rộng cột tối thiểu, mặc định "220px"), `className?`. Render `<div class="ui-grid" style="--grid-min:<min>">` (auto-fill).

- [ ] **Step 1: Viết test thất bại**

Create `src/components/ui/Layout.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Container, Section, Grid } from "./index";

describe("layout", () => {
  it("Container bọc children", () => {
    render(<Container>x</Container>);
    expect(screen.getByText("x")).toHaveClass("ui-container");
  });

  it("Section hiển thị label và index", () => {
    render(
      <Section label="Đang chiếu" index={1}>
        <p>body</p>
      </Section>,
    );
    expect(screen.getByText("Đang chiếu")).toHaveClass("ui-section__label");
    expect(screen.getByText("N°01")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("Grid đặt biến --grid-min", () => {
    const { container } = render(<Grid min="180px">g</Grid>);
    const grid = container.querySelector(".ui-grid");
    expect(grid?.getAttribute("style")).toContain("--grid-min: 180px");
  });
});
```

- [ ] **Step 2: Chạy để thấy fail**

Run: `npx vitest run src/components/ui/Layout.test.tsx`
Expected: FAIL (import chưa có).

- [ ] **Step 3: Thêm style vào `ui.css`**

```css
/* ===== Container ===== */
.ui-container {
  width: 100%;
  max-width: var(--container-max);
  margin: 0 auto;
  padding-inline: var(--gutter);
}

/* ===== Section ===== */
.ui-section {
  padding-block: var(--sp-16);
}
.ui-section__head {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-bottom: var(--sp-8);
}
.ui-section__label {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: var(--tr-wider);
  text-transform: uppercase;
  color: var(--text-muted);
  white-space: nowrap;
}
.ui-section__head .ui-rule {
  flex: 1;
}

/* ===== Grid ===== */
.ui-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--grid-min, 220px), 1fr));
  gap: var(--sp-4);
}
```

- [ ] **Step 4: Tạo `Container.tsx`**

```tsx
import type { ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("ui-container", className)}>{children}</div>;
}
```

- [ ] **Step 5: Tạo `Section.tsx`**

```tsx
import type { ReactNode } from "react";
import { cx } from "lib/cx";
import Numbered from "./Numbered";
import Rule from "./Rule";
import "./ui.css";

export default function Section({
  label,
  index,
  children,
  className,
}: {
  label?: string;
  index?: number;
  children: ReactNode;
  className?: string;
}) {
  const hasHead = label !== undefined || index !== undefined;
  return (
    <section className={cx("ui-section", className)}>
      {hasHead && (
        <div className="ui-section__head">
          {index !== undefined && <Numbered n={index} />}
          {label !== undefined && (
            <span className="ui-section__label">{label}</span>
          )}
          <Rule />
        </div>
      )}
      {children}
    </section>
  );
}
```

- [ ] **Step 6: Tạo `Grid.tsx`**

```tsx
import type { CSSProperties, ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Grid({
  children,
  min = "220px",
  className,
}: {
  children: ReactNode;
  min?: string;
  className?: string;
}) {
  const style: CSSProperties & Record<string, string> = { "--grid-min": min };
  return (
    <div className={cx("ui-grid", className)} style={style}>
      {children}
    </div>
  );
}
```

- [ ] **Step 7: Export trong `index.ts`**

```ts
export { default as Container } from "./Container";
export { default as Section } from "./Section";
export { default as Grid } from "./Grid";
```

- [ ] **Step 8: Chạy test + gate**

Run: `npx vitest run src/components/ui/Layout.test.tsx`
Expected: PASS (3 test).
Run: `npm run typecheck && npm run lint`
Expected: xanh.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/
git commit -m "feat(GD2a/10): layout Container/Section/Grid + test"
```

---

### Task 11: Route dev `/kitchen-sink` + xác minh bằng ảnh

**Files:**
- Create: `src/pages/dev/KitchenSink.tsx`
- Create: `src/pages/dev/KitchenSink.css`
- Modify: `src/App.tsx` (thêm route khi `import.meta.env.DEV`)

**Interfaces:**
- Consumes: toàn bộ export từ `components/ui`.
- Produces: trang `/kitchen-sink` (chỉ mount ở DEV) render mọi primitive ở các trạng thái để chụp ảnh review.

- [ ] **Step 1: Tạo `KitchenSink.css`**

```css
.ks {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  padding: var(--sp-12) 0;
}
.ks h1 {
  font-family: var(--font-display);
  font-size: var(--fs-2xl);
  letter-spacing: var(--tr-tight);
  margin-bottom: var(--sp-8);
}
.ks-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-4);
  align-items: center;
  margin-bottom: var(--sp-6);
}
.ks-block {
  padding: var(--sp-6);
  margin-bottom: var(--sp-8);
  border: var(--bw-1) dashed var(--border-strong);
}
```

- [ ] **Step 2: Tạo `KitchenSink.tsx`**

```tsx
import {
  Button,
  Tag,
  Badge,
  Card,
  Rule,
  Field,
  Skeleton,
  Spinner,
  IconButton,
  Numbered,
  KineticHeading,
  Marquee,
  Reveal,
  TicketEdge,
  Container,
  Section,
  Grid,
} from "components/ui";
import "./KitchenSink.css";

export default function KitchenSink() {
  return (
    <div className="ks">
      <Container>
        <h1>
          <KineticHeading text="KITCHEN SINK" />
        </h1>

        <div className="ks-block">
          <div className="ks-row">
            <Button>Solid</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="invert">Invert</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="ks-row">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </div>

        <div className="ks-block">
          <div className="ks-row">
            <Tag>Mới</Tag>
            <Badge>8.4</Badge>
            <Badge tone="muted">180'</Badge>
            <Numbered n={1} />
            <Numbered n={12} />
          </div>
          <Rule />
          <div className="ks-row">
            <IconButton label="Thông báo">
              <span aria-hidden="true">🔔</span>
            </IconButton>
            <Spinner />
            <Skeleton width="160px" height="20px" />
          </div>
        </div>

        <div className="ks-block">
          <Field label="Email">
            <input placeholder="you@email.com" />
          </Field>
        </div>

        <div className="ks-block u-invert" style={{ padding: 24 }}>
          <p>Khối đảo màu "bone" (chữ đen nền ngà).</p>
        </div>

        <Marquee speed={18}>
          <span style={{ paddingRight: 40 }}>
            DUNE · OPPENHEIMER · JOKER · AVENGERS ·&nbsp;
          </span>
        </Marquee>

        <Section label="Đang chiếu" index={2}>
          <Grid min="200px">
            <Card style={{ height: 120 }} />
            <Card style={{ height: 120 }} />
            <Card style={{ height: 120 }} />
          </Grid>
        </Section>

        <Reveal>
          <TicketEdge>
            <div style={{ padding: 24 }}>Vé xé (mép đục lỗ) + Reveal.</div>
          </TicketEdge>
        </Reveal>
      </Container>
    </div>
  );
}
```

- [ ] **Step 3: Thêm route DEV vào `src/App.tsx`**

Thêm import (đầu file, cùng nhóm import pages):

```tsx
import KitchenSink from "pages/dev/KitchenSink";
```

Trong `<Routes>`, thêm (đặt cạnh các route công khai):

```tsx
{import.meta.env.DEV && (
  <Route path="/kitchen-sink" element={<KitchenSink />} />
)}
```

- [ ] **Step 4: typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: xanh. (Ở production build, route không mount do `import.meta.env.DEV` là false — nhưng import vẫn được tree-shake giữ; chấp nhận.)

- [ ] **Step 5: Chụp `/kitchen-sink` (desktop + mobile) để review**

```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"; [ -f "$CHROME" ] || CHROME="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"; "$CHROME" --headless --disable-gpu --window-size=1440,2200 --hide-scrollbars --screenshot="scratchpad-ks-desktop.png" "http://localhost:3000/kitchen-sink" 2>/dev/null; "$CHROME" --headless --disable-gpu --window-size=390,2600 --hide-scrollbars --screenshot="scratchpad-ks-mobile.png" "http://localhost:3000/kitchen-sink" 2>/dev/null; ls -la scratchpad-ks-*.png
```
Expected: 2 ảnh tạo ra; xem để xác nhận primitive hiển thị đúng (button 4 variant, tag/badge, marquee, section có N°, ticket mép đục lỗ, khối bone). Gửi ảnh cho người dùng review. Xoá ảnh sau khi xem.

- [ ] **Step 6: Toàn bộ gate + Commit**

Run: `npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build`
Expected: tất cả xanh (unit: 28 pricing + 3 cx + các test component).

```bash
git add src/pages/dev/ src/App.tsx
git commit -m "feat(GD2a/11): route dev /kitchen-sink preview toan bo primitive"
```

- [ ] **Step 7: Chạy e2e (đảm bảo trang cũ chưa vỡ) + push lát 2a**

Run: `npm run e2e`
Expected: 3 smoke test xanh.

```bash
git push origin main
```

---

## Self-Review (đã thực hiện khi viết plan)

**Spec coverage:** §2 font self-host → Task 1; §3 token + CSS phân lớp → Task 2; §4 primitive (Button/Tag/Badge/Card/Rule/Field/Skeleton/Spinner/IconButton/Modal) → Task 4–6, 9; primitive kinetic (Marquee/Reveal/TicketEdge/Numbered/KineticHeading) → Task 7–8; layout (Container/Section/Grid) → Task 10; `/kitchen-sink` → Task 11; hạ tầng test → Task 3. §7 reduced-motion → có nhánh trong ui.css mỗi animation; a11y (dialog role, aria-label, focus ring) → Modal/IconButton/Button. *(Query, redesign trang thuộc các lát 2b+; không thuộc plan 2a này.)*

**Placeholder scan:** không có TBD/TODO; mọi step có code/lệnh cụ thể.

**Type consistency:** `cx` (Task 3) dùng nhất quán ở mọi component; `formatIndex`/`Numbered` (Task 7) tái dùng trong `Section` (Task 10); CSS var trong `style` luôn kiểu `CSSProperties & Record<string,string>` (Marquee/KineticHeading/Grid); barrel `index.ts` cộng dồn export qua từng task.

**Ghi chú thứ tự:** Task 3 phải xong trước Task 4+ (mọi component dùng `cx` + hạ tầng test). Task 6 (`IconButton`) trước Task 9 (`Modal` dùng `IconButton`). Task 7 (`Numbered`) trước Task 10 (`Section` dùng `Numbered`).
