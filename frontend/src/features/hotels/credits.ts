export interface Credit { file: string; usedFor: string; source: { text: string; href: string }; author: string; license: { text: string; href: string } }

const LINK = /^\[(.+)\]\((.+)\)$/;
const link = (cell: string) => { const m = LINK.exec(cell.trim()); return m ? { text: m[1], href: m[2] } : { text: cell.trim(), href: '' }; };

/** Parses the data pack's ATTRIBUTIONS.md table (served by the backend at /images). */
export function parseCredits(markdown: string): Credit[] {
  return markdown.split('\n')
    .filter((line) => line.startsWith('| `images/'))
    .map((line) => line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim()))
    .filter((cells) => cells.length >= 5)
    .map(([file, usedFor, source, author, license]) => ({
      file: file.replaceAll('`', ''), usedFor, source: link(source), author, license: link(license),
    }));
}
