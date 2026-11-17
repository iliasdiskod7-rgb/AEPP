import type { CodeNote, SharedNote } from './model'
export type ExportableNote = Pick<CodeNote, 'title' | 'code' | 'comment' | 'createdAt' | 'updatedAt'> & {
  authorName?: string
}
export function noteFilename(title: string) {
  const name =
    title
      .normalize('NFC')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[. ]+$/g, '')
      .slice(0, 110) || 'Σημείωση'
  return name + '_Note.docx'
}
export async function createNoteDocument(note: ExportableNote | SharedNote, authorName = note.authorName ?? '') {
  const {
    Document,
    Paragraph,
    TextRun,
    Footer,
    PageNumber,
    HeadingLevel,
    ShadingType,
    BorderStyle,
    Tab,
    Table,
    TableRow,
    TableCell,
    WidthType,
  } = await import('docx')
  const date = (value: string) =>
    new Intl.DateTimeFormat('el-GR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Athens' }).format(
      new Date(value),
    )
  const heading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 280, after: 160 },
      children: [new TextRun({ text, bold: true, color: '000000', size: 26 })],
    })
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 180 },
      children: [new TextRun({ text: note.title, bold: true, size: 36, color: '000000' })],
    }),
    new Paragraph({ children: [new TextRun({ text: 'Δημιουργός: ' + (authorName || 'Δεν αναφέρεται'), size: 21 })] }),
    new Paragraph({
      children: [new TextRun({ text: 'Δημιουργία: ' + date(note.createdAt), size: 20, color: '475569' })],
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Ενημέρωση: ' + date(note.updatedAt), size: 20, color: '475569' })],
    }),
  ]
  if (note.comment?.trim()) {
    children.push(heading('Προσωπικά σχόλια και σημειώσεις'))
    const border = { style: BorderStyle.SINGLE, size: 4, color: 'DBE4EE' }
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: border,
          bottom: border,
          left: border,
          right: border,
          insideHorizontal: border,
          insideVertical: border,
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                margins: { top: 160, bottom: 160, left: 200, right: 200 },
                shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                children: note.comment
                  .replace(/\r\n?/g, '\n')
                  .split('\n')
                  .map(text => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, size: 22 })] })),
              }),
            ],
          }),
        ],
      }),
    )
  }
  children.push(heading('Κώδικας ΓΛΩΣΣΑΣ'))
  for (const line of note.code.replace(/\r\n?/g, '\n').split('\n')) {
    children.push(
      new Paragraph({
        spacing: { before: 0, after: 0, line: 270 },
        indent: { left: 160, right: 160 },
        shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
        children: line
          .split('\t')
          .flatMap((part, i) => [
            ...(i ? [new TextRun({ children: [new Tab()], font: 'Consolas', size: 21 })] : []),
            new TextRun({ text: part, font: 'Consolas', size: 21, color: '111827' }),
          ]),
      }),
    )
  }
  return new Document({
    creator: authorName || 'AeppHub',
    title: note.title,
    description: 'Σημείωση και κώδικας ΓΛΩΣΣΑΣ',
    styles: { default: { document: { run: { font: 'Calibri', size: 22, color: '000000' } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                spacing: { before: 160 },
                children: [
                  new TextRun({ text: 'Δημιουργήθηκε μέσω του AeppHub  ·  Σελίδα ', size: 18, color: '64748B' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                  new TextRun({ text: ' από ', size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  })
}
export async function exportNoteToWord(note: ExportableNote, authorName = note.authorName ?? '') {
  const [{ Packer }, document] = await Promise.all([import('docx'), createNoteDocument(note, authorName)])
  const blob = await Packer.toBlob(document),
    url = URL.createObjectURL(blob),
    link = window.document.createElement('a')
  link.href = url
  link.download = noteFilename(note.title)
  window.document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}
