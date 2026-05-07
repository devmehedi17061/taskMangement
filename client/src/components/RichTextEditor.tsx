import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write a description…',
  disabled,
  minHeight = 140,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none px-3 py-2 min-h-full text-sm leading-relaxed',
      },
    },
  });

  // Sync external value changes (e.g., switching tasks while modal open).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || '';
    if (current === next) return;
    if (current === '<p></p>' && next === '') return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div
        className="rounded-md border border-slate-300 bg-slate-50"
        style={{ minHeight }}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
      <Toolbar editor={editor} disabled={disabled} />
      <div
        className="overflow-y-auto"
        style={{ minHeight, maxHeight: minHeight * 2 }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

interface ToolbarProps {
  editor: Editor;
  disabled?: boolean;
}

function Toolbar({ editor, disabled }: ToolbarProps) {
  const buttons = [
    {
      icon: Bold,
      title: 'Bold (Ctrl+B)',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      icon: Italic,
      title: 'Italic (Ctrl+I)',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      icon: Strikethrough,
      title: 'Strikethrough',
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
    },
    {
      icon: Code,
      title: 'Inline code',
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive('code'),
    },
    { divider: true } as const,
    {
      icon: Heading1,
      title: 'Heading 1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
    },
    {
      icon: Heading2,
      title: 'Heading 2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
    },
    { divider: true } as const,
    {
      icon: List,
      title: 'Bullet list',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
    },
    {
      icon: ListOrdered,
      title: 'Numbered list',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
    },
    {
      icon: ListChecks,
      title: 'Task list (checkboxes)',
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: editor.isActive('taskList'),
    },
    {
      icon: Quote,
      title: 'Blockquote',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
    },
    { divider: true } as const,
    {
      icon: Undo2,
      title: 'Undo (Ctrl+Z)',
      action: () => editor.chain().focus().undo().run(),
      isActive: false,
      disabled: !editor.can().undo(),
    },
    {
      icon: Redo2,
      title: 'Redo (Ctrl+Shift+Z)',
      action: () => editor.chain().focus().redo().run(),
      isActive: false,
      disabled: !editor.can().redo(),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
      {buttons.map((b, i) => {
        if ('divider' in b) {
          return <span key={`d-${i}`} className="mx-1 h-5 w-px bg-slate-300" />;
        }
        const Icon = b.icon;
        return (
          <button
            key={i}
            type="button"
            onClick={b.action}
            title={b.title}
            disabled={disabled || b.disabled}
            className={`grid h-7 w-7 place-items-center rounded text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 ${
              b.isActive ? 'bg-slate-200 text-ink' : ''
            }`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
