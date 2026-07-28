import { Fragment, ReactNode } from 'react';

// A small hand-rolled markdown-lite renderer for course/lesson content
// (founder request, 2026-07-27). Started as bold/italic-only, but real
// lesson content turned out to actually use fenced code blocks, inline
// code, and bullet/numbered lists (proven by a live screenshot showing
// raw "**bold**"/"- item"/"```css" syntax rendered as literal text) --
// extended to a real markdown subset rather than adding a full
// react-markdown + remark dependency chain for what's still a bounded set
// of block types.
const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE_PATTERN)
    .filter((chunk) => chunk !== '')
    .map((chunk, i) => {
      if (chunk.startsWith('**') && chunk.endsWith('**')) {
        return <strong key={`${keyPrefix}-${i}`}>{chunk.slice(2, -2)}</strong>;
      }
      if (chunk.startsWith('`') && chunk.endsWith('`')) {
        return (
          <code key={`${keyPrefix}-${i}`} className="px-1 py-0.5 rounded bg-gray-100 text-[0.9em] font-mono text-gray-800">
            {chunk.slice(1, -1)}
          </code>
        );
      }
      if (chunk.startsWith('*') && chunk.endsWith('*')) {
        return <em key={`${keyPrefix}-${i}`}>{chunk.slice(1, -1)}</em>;
      }
      return <Fragment key={`${keyPrefix}-${i}`}>{chunk}</Fragment>;
    });
}

type Block =
  | { type: 'code'; code: string }
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string };

const FENCE_PATTERN = /^```\w*\s*$/;
const CLOSING_FENCE_PATTERN = /^```\s*$/;
const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/;
const UL_PATTERN = /^[-*]\s+(.*)$/;
const OL_PATTERN = /^\d+\.\s+(.*)$/;

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraphBuf: string[] = [];

  const flushParagraph = () => {
    const joined = paragraphBuf.join(' ').trim();
    if (joined) blocks.push({ type: 'p', text: joined });
    paragraphBuf = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (FENCE_PATTERN.test(line)) {
      flushParagraph();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !CLOSING_FENCE_PATTERN.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip the closing fence (or end of input if unterminated)
      blocks.push({ type: 'code', code: codeLines.join('\n') });
      continue;
    }

    const headingMatch = line.match(HEADING_PATTERN);
    if (headingMatch) {
      flushParagraph();
      blocks.push({ type: 'heading', level: headingMatch[1].length as 1 | 2 | 3, text: headingMatch[2] });
      i += 1;
      continue;
    }

    const ulMatch = line.match(UL_PATTERN);
    if (ulMatch) {
      flushParagraph();
      const items = [ulMatch[1]];
      i += 1;
      while (i < lines.length) {
        const m = lines[i].match(UL_PATTERN);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    const olMatch = line.match(OL_PATTERN);
    if (olMatch) {
      flushParagraph();
      const items = [olMatch[1]];
      i += 1;
      while (i < lines.length) {
        const m = lines[i].match(OL_PATTERN);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      i += 1;
      continue;
    }

    paragraphBuf.push(line.trim());
    i += 1;
  }
  flushParagraph();
  return blocks;
}

const HEADING_TAGS = { 1: 'h3', 2: 'h4', 3: 'h5' } as const;
const HEADING_SIZES = { 1: 'text-xl', 2: 'text-lg', 3: 'text-base' } as const;

export function renderRichText(text: string): ReactNode {
  return parseBlocks(text).map((block, i) => {
    switch (block.type) {
      case 'code':
        // Light, not dark -- founder flagged the dark code block as
        // clashing with the rest of the app's paper-light surfaces.
        return (
          <pre key={i} className="bg-gray-50 border border-canvas-150 text-gray-800 rounded-[10px] p-4 overflow-x-auto text-sm my-3">
            <code>{block.code}</code>
          </pre>
        );
      case 'heading': {
        const Tag = HEADING_TAGS[block.level];
        return (
          <Tag key={i} className={`${HEADING_SIZES[block.level]} font-semibold text-gray-900 mt-4 mb-2`}>
            {renderInline(block.text, `h${i}`)}
          </Tag>
        );
      }
      case 'ul':
        return (
          <ul key={i} className="list-disc pl-5 space-y-1 my-2">
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, `ul${i}-${j}`)}</li>
            ))}
          </ul>
        );
      case 'ol':
        return (
          <ol key={i} className="list-decimal pl-5 space-y-1 my-2">
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item, `ol${i}-${j}`)}</li>
            ))}
          </ol>
        );
      case 'p':
      default:
        return (
          <p key={i} className={i > 0 ? 'mt-3' : undefined}>
            {renderInline(block.text, `p${i}`)}
          </p>
        );
    }
  });
}
