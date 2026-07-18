// Nối className: giữ phần truthy, bỏ false/null/undefined/rỗng.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
