/** Replace `{key}` placeholders. Unknown keys are left as-is so a missing value is visible, not silent. */
export function fill(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key]
    return v === undefined ? whole : String(v)
  })
}
