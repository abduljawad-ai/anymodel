import { renderMarkdown } from '../../src/lib/markdown';

test('renders basic markdown', () => {
  const html = renderMarkdown('# Hi\n\n**bold**');
  expect(html).toContain('<h1>');
  expect(html).toContain('<strong>bold</strong>');
});

test('strips scripts and dangerous protocols', () => {
  expect(renderMarkdown('<script>alert(1)</script>')).not.toContain('<script');
  expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('javascript:');
  expect(renderMarkdown('[y](https://a.dev)')).toContain('href="https://a.dev"');
});

test('keeps code blocks but escapes html inside them', () => {
  const html = renderMarkdown('```\n<img src=x onerror=alert(1)>\n```');
  expect(html).toContain('&lt;img');
});
