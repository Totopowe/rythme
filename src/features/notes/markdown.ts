import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

// Les liens s'ouvrent dans un nouvel onglet, sans accès à la page d'origine.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Markdown → HTML assaini. */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false });
  return DOMPurify.sanitize(html);
}

/** Titre déduit de la première ligne si la note n'en a pas. */
export function noteDisplayTitle(title: string, body: string): string {
  if (title.trim()) return title.trim();
  const firstLine = body.split('\n').find((l) => l.trim());
  return firstLine ? firstLine.replace(/^#+\s*/, '').trim().slice(0, 80) : 'Sans titre';
}
