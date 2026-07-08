// Accessibility audit against a running dev/preview server, using the real
// axe-core rule engine in a real Chromium (no mocked DOM). Run with the app
// already serving at BASE_URL (defaults to http://localhost:5173).
//
//   npm run test:a11y
//
// Exits non-zero if any "serious" or "critical" violations are found —
// "moderate"/"minor" are printed but don't fail the run, since axe flags
// some things (e.g. color contrast on decorative elements) that need human
// judgment.
import puppeteer from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';

const BASE_URL = process.env.A11Y_BASE_URL ?? 'http://localhost:5173';
const FAIL_ON_IMPACT = new Set(['serious', 'critical']);

async function auditCurrentPage(page, label) {
  const results = await new AxePuppeteer(page).analyze();
  return { label, violations: results.violations };
}

async function main() {
  // --no-sandbox/--disable-setuid-sandbox: Chromium's own sandbox needs
  // user-namespace privileges GitHub Actions' containers don't grant.
  // Harmless (and unnecessary) locally, required in that CI environment.
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const reports = [];

  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  reports.push(await auditCurrentPage(page, 'Home'));

  await page.click('nav button ::-p-text(Courses)').catch(() => {});
  // Fallback: click via evaluate if the pseudo-selector above isn't supported.
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('nav button'));
    const coursesBtn = buttons.find((b) => b.textContent?.trim() === 'Courses');
    coursesBtn?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  reports.push(await auditCurrentPage(page, 'Courses list'));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const signInBtn = buttons.find((b) => b.textContent?.trim() === 'Sign In');
    signInBtn?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  reports.push(await auditCurrentPage(page, 'Auth modal (sign in)'));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const signUpToggle = buttons.find((b) => b.textContent?.includes("Don't have an account?"));
    signUpToggle?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  reports.push(await auditCurrentPage(page, 'Auth modal (create account)'));

  await browser.close();

  let hasFailure = false;
  for (const { label, violations } of reports) {
    console.log(`\n=== ${label}: ${violations.length} violation type(s) ===`);
    for (const v of violations) {
      const marker = FAIL_ON_IMPACT.has(v.impact ?? '') ? '✘' : '·';
      console.log(`${marker} [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
      for (const node of v.nodes.slice(0, 3)) {
        console.log(`    ${node.target.join(' ')}`);
      }
      if (FAIL_ON_IMPACT.has(v.impact ?? '')) hasFailure = true;
    }
    if (violations.length === 0) console.log('  (clean)');
  }

  if (hasFailure) {
    console.error('\nAccessibility audit found serious/critical violations.');
    process.exit(1);
  }
  console.log('\nNo serious or critical violations found.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
