/** Product of the inline scaleX(-1) flips on an element and all its ancestors: +1 reads correctly, -1 is mirrored. */
export function netMirror(el: Element | null): 1 | -1 {
  let sign = 1;
  for (let e: Element | null = el; e; e = e.parentElement) {
    const t = (e as HTMLElement).style?.transform ?? '';
    if (/scaleX\(-1\)/.test(t)) sign = -sign;
  }
  return sign as 1 | -1;
}
