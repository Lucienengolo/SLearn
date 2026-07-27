import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Award } from 'lucide-react';
import IconBadge from '../components/UI/IconBadge';

describe('IconBadge', () => {
  it('renders the icon at the requested size', () => {
    const { container } = render(<IconBadge icon={Award} tone="gold" size={48} iconSize={24} />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.style.width).toBe('48px');
    expect(badge.style.height).toBe('48px');
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
  });

  it('defaults iconSize to half the badge size', () => {
    const { container } = render(<IconBadge icon={Award} tone="green" size={40} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '20');
  });

  it('renders a circle by default and a rounded square when shape="square"', () => {
    const circle = render(<IconBadge icon={Award} tone="blue" />);
    expect(circle.container.firstElementChild).toHaveClass('rounded-full');

    const square = render(<IconBadge icon={Award} tone="blue" shape="square" />);
    expect(square.container.firstElementChild).toHaveClass('rounded-[10px]');
  });

  it('uses a distinct gradient per tone', () => {
    const gold = render(<IconBadge icon={Award} tone="gold" />);
    const red = render(<IconBadge icon={Award} tone="red" />);
    const goldBg = (gold.container.firstElementChild as HTMLElement).style.background;
    const redBg = (red.container.firstElementChild as HTMLElement).style.background;
    expect(goldBg).not.toBe(redBg);
  });
});
