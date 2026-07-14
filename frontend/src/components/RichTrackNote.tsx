import { useEffect, useRef } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import type { Editor, JSONContent } from "@tiptap/core";
import type { NoteContentFormat } from "@/types/api";
import { parseNoteDocument } from "@/lib/richText";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: false,
  }),
  Link.configure({ openOnClick: false, defaultProtocol: "https" }),
];

interface EditorProps {
  initialContent: string;
  contentFormat: NoteContentFormat;
  authorName: string;
  onSave: (content: string, format: NoteContentFormat) => void;
}

export function RichTrackNoteEditor({
  initialContent,
  contentFormat,
  authorName,
  onSave,
}: EditorProps) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changedRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const editor = useEditor({
    extensions,
    content: parseNoteDocument(initialContent, contentFormat),
    editorProps: {
      attributes: {
        class:
          "rich-note-content min-h-40 max-h-80 overflow-y-auto px-4 py-4 focus:outline-none",
        "aria-label": "Track note",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      changedRef.current = true;
      editorRef.current = currentEditor;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        onSaveRef.current(
          JSON.stringify(currentEditor.getJSON()),
          "tiptap_json",
        );
      }, 1000);
    },
    onCreate: ({ editor: currentEditor }) => {
      editorRef.current = currentEditor;
    },
  });

  useEffect(
    () => () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (changedRef.current && editorRef.current) {
        onSaveRef.current(
          JSON.stringify(editorRef.current.getJSON()),
          "tiptap_json",
        );
      }
    },
    [],
  );

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-(--card-border) bg-linear-to-b from-(--card-gradient-from) to-(--card-gradient-to)">
      <div className="flex items-center justify-between gap-2.5 border-b border-(--control-border-subtle) px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--action-bg) text-xs font-semibold text-(--text-0)/70">
            {authorName[0]?.toUpperCase()}
          </div>
          <span className="text-sm text-(--text-0)/60">@{authorName}</span>
        </div>
        <span className="select-none text-xs text-(--text-0)/25">Your note</span>
      </div>
      <RichTextToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function RichTextToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor.isActive("bold"),
      italic: currentEditor.isActive("italic"),
      heading2: currentEditor.isActive("heading", { level: 2 }),
      heading3: currentEditor.isActive("heading", { level: 3 }),
      bulletList: currentEditor.isActive("bulletList"),
      orderedList: currentEditor.isActive("orderedList"),
      blockquote: currentEditor.isActive("blockquote"),
      link: currentEditor.isActive("link"),
      canUndo: currentEditor.can().undo(),
      canRedo: currentEditor.can().redo(),
    }),
  });

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const controls = [
    { label: "Bold", icon: Bold, active: state.bold, action: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: Italic, active: state.italic, action: () => editor.chain().focus().toggleItalic().run() },
    { label: "Heading 2", icon: Heading2, active: state.heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Heading 3", icon: Heading3, active: state.heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Bullet list", icon: List, active: state.bulletList, action: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, active: state.orderedList, action: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Blockquote", icon: Quote, active: state.blockquote, action: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Link", icon: LinkIcon, active: state.link, action: setLink },
    { label: "Undo", icon: Undo2, active: false, action: () => editor.chain().focus().undo().run(), disabled: !state.canUndo },
    { label: "Redo", icon: Redo2, active: false, action: () => editor.chain().focus().redo().run(), disabled: !state.canRedo },
  ];

  return (
      <div className="flex touch-pan-x gap-1 overflow-x-auto border-b border-(--control-border-subtle) p-2" role="toolbar" aria-label="Note formatting">
        {controls.map(({ label, icon: Icon, active, action, disabled }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-lg"
                variant="ghost"
                className={active ? "themed-control-active shrink-0" : "shrink-0 hover:bg-(--control-bg-hover)"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={action}
                disabled={disabled}
                aria-label={label}
                aria-pressed={active || undefined}
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
  );
}

export function RichTrackNoteContent({ content }: { content: string }) {
  const document = parseNoteDocument(content, "tiptap_json");
  return <ReadOnlyEditor document={document} />;
}

function ReadOnlyEditor({ document }: { document: JSONContent }) {
  const editor = useEditor({
    extensions,
    content: document,
    editable: false,
    editorProps: {
      attributes: { class: "rich-note-content text-sm leading-relaxed" },
    },
  });

  return <EditorContent editor={editor} />;
}
