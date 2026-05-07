import { parse, type HTMLElement, type Node as HtmlNode, NodeType } from 'node-html-parser';
import type { docs_v1 } from 'googleapis';

interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
}

type BlockType = 'p' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'task' | 'quote' | 'code' | 'hr';

export interface Block {
  type: BlockType;
  runs: InlineRun[];
  checked?: boolean;
}

interface ParagraphInfo {
  type: BlockType;
  start: number;
  end: number;
  runs: InlineRun[];
  runStarts: number[];
  checked?: boolean;
}

function isElement(n: HtmlNode): n is HTMLElement {
  return n.nodeType === NodeType.ELEMENT_NODE;
}

function tagOf(n: HTMLElement): string {
  return (n.tagName || '').toLowerCase();
}

function collectInline(node: HtmlNode, marks: Omit<InlineRun, 'text'>): InlineRun[] {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const text = node.text;
    if (!text) return [];
    return [{ text, ...marks }];
  }
  if (!isElement(node)) return [];
  const tag = tagOf(node);
  let next = { ...marks };
  if (tag === 'strong' || tag === 'b') next.bold = true;
  else if (tag === 'em' || tag === 'i') next.italic = true;
  else if (tag === 's' || tag === 'strike' || tag === 'del') next.strike = true;
  else if (tag === 'code') next.code = true;
  else if (tag === 'br') return [{ text: '', ...marks }]; // soft line break in Docs

  const runs: InlineRun[] = [];
  for (const child of node.childNodes) runs.push(...collectInline(child, next));
  return runs;
}

function mergeRuns(runs: InlineRun[]): InlineRun[] {
  const out: InlineRun[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (
      last &&
      !!last.bold === !!r.bold &&
      !!last.italic === !!r.italic &&
      !!last.strike === !!r.strike &&
      !!last.code === !!r.code
    ) {
      last.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

function block(type: BlockType, runs: InlineRun[]): Block {
  return { type, runs: mergeRuns(runs) };
}

function walk(node: HtmlNode, blocks: Block[]): void {
  if (!isElement(node)) return;
  for (const child of node.childNodes) {
    if (!isElement(child)) {
      const text = child.text;
      if (text && text.trim()) blocks.push(block('p', [{ text }]));
      continue;
    }
    const tag = tagOf(child);
    switch (tag) {
      case 'p':
        blocks.push(block('p', collectInline(child, {})));
        break;
      case 'h1':
        blocks.push(block('h1', collectInline(child, {})));
        break;
      case 'h2':
        blocks.push(block('h2', collectInline(child, {})));
        break;
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        blocks.push(block('h3', collectInline(child, {})));
        break;
      case 'ul': {
        const isTaskList = (child.getAttribute?.('data-type') ?? '') === 'taskList';
        for (const li of child.childNodes) {
          if (!isElement(li) || tagOf(li) !== 'li') continue;
          if (isTaskList) {
            const checked = (li.getAttribute?.('data-checked') ?? '') === 'true';
            // Tiptap renders: <li><label><input/><span/></label><div><p>...</p></div></li>
            // We want only the inline runs of the inner content, ignoring the checkbox label.
            const contentNode = li.childNodes.find(
              (n) => isElement(n) && tagOf(n) === 'div',
            ) as HTMLElement | undefined;
            const runs = contentNode
              ? collectInline(contentNode, {})
              : collectInline(li, {});
            blocks.push({ ...block('task', runs), checked });
          } else {
            blocks.push(block('bullet', collectInline(li, {})));
          }
        }
        break;
      }
      case 'ol':
        for (const li of child.childNodes) {
          if (isElement(li) && tagOf(li) === 'li') {
            blocks.push(block('numbered', collectInline(li, {})));
          }
        }
        break;
      case 'blockquote': {
        const inlines = collectInline(child, {});
        if (inlines.length) blocks.push(block('quote', inlines));
        break;
      }
      case 'pre': {
        // tiptap codeBlock = <pre><code>...</code></pre>
        const text = child.text || '';
        blocks.push({ type: 'code', runs: text ? [{ text, code: true }] : [] });
        break;
      }
      case 'hr':
        blocks.push({ type: 'hr', runs: [] });
        break;
      default:
        walk(child, blocks);
    }
  }
}

export function parseHtmlToBlocks(html: string): Block[] {
  if (!html || !html.trim()) return [];
  const root = parse(html.trim());
  const blocks: Block[] = [];
  walk(root, blocks);
  return blocks;
}

function namedStyleFor(t: BlockType): docs_v1.Schema$ParagraphStyle['namedStyleType'] | null {
  switch (t) {
    case 'h1':
      return 'HEADING_1';
    case 'h2':
      return 'HEADING_2';
    case 'h3':
      return 'HEADING_3';
    case 'p':
    case 'bullet':
    case 'numbered':
    case 'task':
    case 'quote':
    case 'code':
    case 'hr':
      return 'NORMAL_TEXT';
    default:
      return null;
  }
}

/**
 * Build Google Docs API requests that insert a section [optionally preceded by a blank line]
 * containing the header (Heading 2) followed by `blocks`. All requests are anchored at
 * `startIndex`. Returns the assembled requests and the total inserted character length.
 */
export function buildSectionRequests(
  startIndex: number,
  prependNewline: boolean,
  headerText: string,
  blocks: Block[],
): { requests: docs_v1.Schema$Request[]; insertedLength: number } {
  const allBlocks: Block[] = [{ type: 'h2', runs: [{ text: headerText }] }, ...blocks];

  let buffer = prependNewline ? '\n' : '';
  const paragraphs: ParagraphInfo[] = [];

  for (const b of allBlocks) {
    const pStart = startIndex + buffer.length;
    let blockText = '';
    const runStarts: number[] = [];
    if (b.type === 'hr') {
      blockText = '———';
    } else {
      for (const r of b.runs) {
        runStarts.push(pStart + blockText.length);
        blockText += r.text;
      }
    }
    buffer += blockText + '\n';
    paragraphs.push({
      type: b.type,
      start: pStart,
      end: pStart + blockText.length + 1,
      runs: b.runs,
      runStarts,
      checked: b.checked,
    });
  }

  if (!buffer) return { requests: [], insertedLength: 0 };

  const requests: docs_v1.Schema$Request[] = [
    { insertText: { location: { index: startIndex }, text: buffer } },
  ];

  // Paragraph styles
  for (const p of paragraphs) {
    const named = namedStyleFor(p.type);
    if (named) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: p.start, endIndex: p.end },
          paragraphStyle: { namedStyleType: named },
          fields: 'namedStyleType',
        },
      });
    }
    if (p.type === 'quote') {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: p.start, endIndex: p.end },
          paragraphStyle: {
            indentStart: { magnitude: 36, unit: 'PT' },
            indentFirstLine: { magnitude: 36, unit: 'PT' },
          },
          fields: 'indentStart,indentFirstLine',
        },
      });
    }
  }

  // List bullets — group consecutive bullet/numbered/task paragraphs
  let i = 0;
  while (i < paragraphs.length) {
    const p = paragraphs[i]!;
    if (p.type === 'bullet' || p.type === 'numbered' || p.type === 'task') {
      const t = p.type;
      let j = i;
      while (j < paragraphs.length && paragraphs[j]!.type === t) j++;
      const rangeStart = paragraphs[i]!.start;
      const rangeEnd = paragraphs[j - 1]!.end;
      const preset =
        t === 'bullet'
          ? 'BULLET_DISC_CIRCLE_SQUARE'
          : t === 'numbered'
            ? 'NUMBERED_DECIMAL_ALPHA_ROMAN'
            : 'BULLET_CHECKBOX';
      requests.push({
        createParagraphBullets: {
          range: { startIndex: rangeStart, endIndex: rangeEnd },
          bulletPreset: preset,
        },
      });
      i = j;
    } else {
      i++;
    }
  }

  // For checked task items, apply strikethrough to the whole paragraph's text run.
  for (const p of paragraphs) {
    if (p.type !== 'task' || !p.checked) continue;
    if (p.start >= p.end - 1) continue; // empty paragraph (just the trailing \n)
    requests.push({
      updateTextStyle: {
        range: { startIndex: p.start, endIndex: p.end - 1 },
        textStyle: { strikethrough: true },
        fields: 'strikethrough',
      },
    });
  }

  // Inline text styles (bold/italic/strike/code)
  for (const p of paragraphs) {
    for (let k = 0; k < p.runs.length; k++) {
      const run = p.runs[k]!;
      if (!run.text) continue;
      if (!run.bold && !run.italic && !run.strike && !run.code) continue;
      const start = p.runStarts[k]!;
      const end = start + run.text.length;
      const ts: docs_v1.Schema$TextStyle = {};
      const fields: string[] = [];
      if (run.bold) {
        ts.bold = true;
        fields.push('bold');
      }
      if (run.italic) {
        ts.italic = true;
        fields.push('italic');
      }
      if (run.strike) {
        ts.strikethrough = true;
        fields.push('strikethrough');
      }
      if (run.code) {
        ts.weightedFontFamily = { fontFamily: 'Consolas' };
        ts.backgroundColor = {
          color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } },
        };
        fields.push('weightedFontFamily', 'backgroundColor');
      }
      requests.push({
        updateTextStyle: {
          range: { startIndex: start, endIndex: end },
          textStyle: ts,
          fields: fields.join(','),
        },
      });
    }
  }

  return { requests, insertedLength: buffer.length };
}

// ---------------- Doc inspection helpers ----------------

export function paragraphText(p: docs_v1.Schema$Paragraph): string {
  return (p.elements ?? []).map((e) => e.textRun?.content ?? '').join('');
}

export function isDocEmpty(doc: docs_v1.Schema$Document): boolean {
  const body = doc.body?.content ?? [];
  for (const el of body) {
    if (!el.paragraph) continue;
    const t = paragraphText(el.paragraph).replace(/\s/g, '');
    if (t.length > 0) return false;
  }
  return true;
}

/** Returns the index where new content should be inserted to append at the end of body. */
export function endOfBodyIndex(doc: docs_v1.Schema$Document): number {
  const body = doc.body?.content ?? [];
  const last = body[body.length - 1];
  const end = last?.endIndex ?? 2;
  return Math.max(1, end - 1);
}

export interface SectionRange {
  startIndex: number;
  endIndex: number;
}

const SECTION_HEADER_RE = /^Task T\d+ —/;

/** Locate `[startIndex, endIndex)` for the section whose header matches the given taskId. */
export function findSectionRange(doc: docs_v1.Schema$Document, taskId: string): SectionRange | null {
  const body = doc.body?.content ?? [];
  const headerPrefix = `Task ${taskId} —`;
  let sectionStart: number | null = null;
  let sectionEnd: number | null = null;

  for (let i = 0; i < body.length; i++) {
    const el = body[i]!;
    if (!el.paragraph) continue;
    const text = paragraphText(el.paragraph).trim();
    if (sectionStart === null) {
      if (text.startsWith(headerPrefix)) {
        sectionStart = el.startIndex ?? null;
      }
    } else if (SECTION_HEADER_RE.test(text)) {
      sectionEnd = el.startIndex ?? null;
      break;
    }
  }
  if (sectionStart === null) return null;
  if (sectionEnd === null) {
    sectionEnd = endOfBodyIndex(doc);
  }
  return { startIndex: sectionStart, endIndex: sectionEnd };
}
