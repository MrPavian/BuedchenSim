/** Tiny DOM helpers. Data is always written with textContent, never innerHTML. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function testId<T extends HTMLElement>(node: T, id: string): T {
  node.dataset['testid'] = id;
  return node;
}

export function button(label: string, id: string, onClick: () => void, className = 'ui-btn'): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  testId(node, id);
  node.addEventListener('click', onClick);
  return node;
}

/** Small coloured chip from a product's label colours and text. */
export function swatch(label: { primaryColor: string; accentColor: string; text: string }): HTMLElement {
  const node = el('span', 'ui-swatch', label.text);
  node.style.backgroundColor = label.primaryColor;
  node.style.color = label.accentColor;
  return node;
}

export function ageBadge(text: string, title: string, id: string): HTMLElement {
  const node = el('span', 'ui-age', text);
  node.title = title;
  return testId(node, id);
}

export function quantityInput(value: number, id: string, max: number, onCommit: (value: number) => void): HTMLInputElement {
  const input = el('input', 'ui-qty');
  input.type = 'number';
  input.min = '0';
  input.max = String(max);
  input.step = '1';
  input.value = String(value);
  testId(input, id);
  input.addEventListener('change', () => onCommit(input.valueAsNumber));
  return input;
}
