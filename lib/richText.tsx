import { Fragment, ReactNode } from 'react';

// Lightweight **bold**/*italic* renderer for course descriptions (founder
// request, 2026-07-27: "esthetic ... bold header italic note"). A full
// markdown library (react-markdown + remark) is more than a short course
// blurb needs -- this covers the two emphasis marks instructors actually
// asked for, plus paragraph breaks on blank lines, with zero new
// dependencies.
const EMPHASIS_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(EMPHASIS_PATTERN).map((chunk, i) => {
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`}>{chunk.slice(2, -2)}</strong>;
    }
    if (chunk.startsWith('*') && chunk.endsWith('*')) {
      return <em key={`${keyPrefix}-${i}`}>{chunk.slice(1, -1)}</em>;
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{chunk}</Fragment>;
  });
}

export function renderRichText(text: string): ReactNode {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  return paragraphs.map((paragraph, i) => (
    <p key={i} className={i > 0 ? 'mt-3' : undefined}>
      {renderInline(paragraph, `p${i}`)}
    </p>
  ));
}
