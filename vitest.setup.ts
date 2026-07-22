import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollIntoView at all -- components that
// auto-scroll a chat/list to the latest item (e.g. Chat.tsx) throw
// "scrollIntoView is not a function" under RTL without this stub.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
