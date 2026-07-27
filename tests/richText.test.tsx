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
});
