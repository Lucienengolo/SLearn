import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderRichText } from '../lib/richText';

describe('renderRichText', () => {
  it('renders plain text with no emphasis markers as-is', () => {
    render(<div>{renderRichText('Plain sentence.')}</div>);
    expect(screen.getByText('Plain sentence.')).toBeInTheDocument();
  });

  it('renders **bold** as a <strong>', () => {
    render(<div>{renderRichText('This is **important**.')}</div>);
    const strong = screen.getByText('important');
    expect(strong.tagName).toBe('STRONG');
  });

  it('renders *italic* as an <em>', () => {
    render(<div>{renderRichText('*Note:* read carefully.')}</div>);
    const em = screen.getByText('Note:');
    expect(em.tagName).toBe('EM');
  });

  it('splits double newlines into separate paragraphs', () => {
    const { container } = render(<div>{renderRichText('First paragraph.\n\nSecond paragraph.')}</div>);
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(screen.getByText('First paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
  });

  it('joins single-newline-wrapped lines into one flowing paragraph', () => {
    const { container } = render(<div>{renderRichText('Line one\nline two\nline three')}</div>);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.textContent).toBe('Line one line two line three');
  });

  it('renders `inline code` as a <code> element', () => {
    render(<div>{renderRichText('Sized by `width` and `height`.')}</div>);
    const code = screen.getByText('width');
    expect(code.tagName).toBe('CODE');
  });

  it('renders a fenced code block as <pre><code>, untouched by emphasis parsing', () => {
    const { container } = render(
      <div>{renderRichText('```css\n.card {\n  width: 300px;\n}\n```')}</div>
    );
    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre?.querySelector('code')?.textContent).toBe('.card {\n  width: 300px;\n}');
  });

  it('renders a dash bullet list as <ul><li>, with inline emphasis inside items', () => {
    const { container } = render(
      <div>{renderRichText('- **Content** — the text\n- **Padding** — the space')}</div>
    );
    const ul = container.querySelector('ul');
    expect(ul).toBeInTheDocument();
    expect(ul?.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByText('Content').tagName).toBe('STRONG');
  });

  it('renders a numbered list as <ol><li>', () => {
    const { container } = render(<div>{renderRichText('1. First step\n2. Second step')}</div>);
    const ol = container.querySelector('ol');
    expect(ol).toBeInTheDocument();
    expect(ol?.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders a # heading line as a heading element', () => {
    const { container } = render(<div>{renderRichText('## Section title\n\nBody text.')}</div>);
    expect(container.querySelector('h4')?.textContent).toBe('Section title');
  });

  it('renders the exact mixed CSS-lesson content correctly (regression for the raw-markdown bug)', () => {
    const content = [
      'Content, padding, border, and margin.',
      '',
      'Each box is made of four layers:',
      '- **Content** — sized by `width` and `height`.',
      '- **Padding** — space between content and border.',
      '',
      '```css',
      '.card {',
      '  width: 300px;',
      '}',
      '```',
    ].join('\n');

    const { container } = render(<div>{renderRichText(content)}</div>);

    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(container.querySelector('ul')?.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('pre code')?.textContent).toContain('width: 300px;');
    // No raw "**"/"`"/"```" markdown syntax should leak into rendered text.
    expect(container.textContent).not.toMatch(/\*\*|```/);
  });
});
