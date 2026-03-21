import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const COLORS = [
  { label: "Default", value: "" },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#22c55e" },
  { label: "Purple", value: "#a855f7" },
  { label: "Gray", value: "#6b7280" },
];

function ToolbarButton({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "h-7 min-w-7 px-1.5 rounded text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    editable: true,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class: "min-h-[160px] outline-none text-sm leading-relaxed px-3 py-2 cursor-text prose prose-sm max-w-none focus:outline-none",
      },
    },
  });

  // Sync external value changes (e.g. when editing an existing course loads async)
  useEffect(() => {
    if (!editor) return;
    const editorIsEmpty = editor.isEmpty;
    const incomingHasContent = value && value.trim().length > 0;
    // Only overwrite if editor is empty but we now have a value (initial load scenario)
    if (editorIsEmpty && incomingHasContent) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5 bg-muted/40">
        {/* Bold / Italic / Underline / Strike */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <span className="line-through">S</span>
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading">
          H2
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Subheading">
          H3
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          ≡
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          1.
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
          ←
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center">
          ↔
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
          →
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Font color */}
        <div className="flex items-center gap-0.5" title="Text color">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onMouseDown={(e) => {
                e.preventDefault();
                if (c.value) {
                  editor.chain().focus().setColor(c.value).run();
                } else {
                  editor.chain().focus().unsetColor().run();
                }
              }}
              className={cn(
                "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
                editor.isActive("textStyle", { color: c.value || undefined })
                  ? "border-foreground scale-110"
                  : "border-transparent"
              )}
              style={{ backgroundColor: c.value || "currentColor" }}
            />
          ))}
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Clear formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting">
          ✕
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <p className="absolute top-2 left-3 text-sm text-muted-foreground pointer-events-none select-none">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/** Read-only renderer for saved HTML curriculum content */
export function RichTextDisplay({ html, className }: { html: string; className?: string }) {
  return (
    <>
      <style>{`
        .rich-text-display h2 { font-size: 1rem; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.25rem; }
        .rich-text-display h3 { font-size: 0.875rem; font-weight: 600; margin-top: 0.5rem; margin-bottom: 0.125rem; }
        .rich-text-display p { margin-bottom: 0.375rem; }
        .rich-text-display ul { list-style-type: disc; padding-left: 1.25rem; }
        .rich-text-display ol { list-style-type: decimal; padding-left: 1.25rem; }
        .rich-text-display li { margin-bottom: 0.125rem; }
        .rich-text-display strong { font-weight: 600; }
        .rich-text-display em { font-style: italic; }
        .rich-text-display u { text-decoration: underline; }
        .rich-text-display s { text-decoration: line-through; }
      `}</style>
      <div
        className={cn("rich-text-display text-sm text-muted-foreground leading-relaxed", className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
