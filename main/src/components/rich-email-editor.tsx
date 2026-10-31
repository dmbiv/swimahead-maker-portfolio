"use client";

import * as FormControl from "@/components/form-control";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  EMAIL_IMAGE_ACCEPT,
  EmailImageUploadError,
  emailImageAltText,
  emailImageDisplayWidth,
  uploadEmailImage,
  validateEmailImage,
} from "@/lib/email-image-upload";

interface RichEmailEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  mergeFields?: readonly string[];
  onFocus?: () => void;
  registerInsert?: (insert: ((text: string) => void) | null) => void;
  placeholder?: string;
}

function Tool({ active = false, disabled = false, label, onClick, children }: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="email-tool"
      data-active={active}
      aria-pressed={active}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  bold: <><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" /><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" /></>,
  italic: <><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></>,
  underline: <><path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="4" y1="21" x2="20" y2="21" /></>,
  heading: <><path d="M6 4v16" /><path d="M18 4v16" /><path d="M6 12h12" /></>,
  bulletList: <><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" /></>,
  orderedList: <><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><path d="M4 4.5h1.4V9M4 9h2.2" strokeWidth="1.6" /><path d="M4.2 14.5c.9-.7 2-.2 2 .7 0 .8-1.4 1.3-2 2.3h2.2" strokeWidth="1.6" /></>,
  quote: <><path d="M7 7H4v6h4V9c0-1 .5-2 2-2" /><path d="M17 7h-3v6h4V9c0-1 .5-2 2-2" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4.5-4.5a1.6 1.6 0 0 1 2.2 0L16 18" /><path d="m14 15 1.8-1.8a1.6 1.6 0 0 1 2.2 0L21 16" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="12" y1="4" x2="12" y2="20" /></>,
  alignLeft: <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="18" y2="18" /></>,
  alignCenter: <><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="5" y1="18" x2="19" y2="18" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></>,
  redo: <><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h1" /></>,
};

export function RichEmailEditor({ value, onChange, disabled = false, mergeFields = [], onFocus, registerInsert, placeholder }: RichEmailEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadNotice, setImageUploadNotice] = useState<{
    tone: "info" | "error";
    message: string;
  } | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    content: value,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TextStyleKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: true, allowBase64: false }),
      TableKit.configure({ table: { resizable: true } }),
      ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
    ],
    editorProps: {
      attributes: {
        class: "email-editor-content",
        "aria-label": "Email body",
      },
    },
    onFocus: () => onFocus?.(),
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!registerInsert) return;
    registerInsert(editor ? (text: string) => editor.chain().focus().insertContent(text).run() : null);
    return () => registerInsert(null);
  }, [editor, registerInsert]);

  if (!editor) return <div className="email-editor-loading">Loading editor...</div>;

  const addLink = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", current ?? "https://");
    if (href == null) return;
    if (!href.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  const chooseImage = () => {
    setImageUploadNotice(null);
    imageInputRef.current?.click();
  };

  const addImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const validationError = validateEmailImage(file);
    if (validationError) {
      setImageUploadNotice({ tone: "error", message: validationError });
      return;
    }

    setImageUploading(true);
    setImageUploadNotice({ tone: "info", message: `Uploading ${file.name}...` });
    try {
      const widthPromise = emailImageDisplayWidth(file);
      const src = await uploadEmailImage(file);
      const width = await widthPromise;
      const inserted = editor.chain().focus().setImage({
        src,
        alt: emailImageAltText(file.name),
        ...(width ? { width } : {}),
      }).run();
      if (!inserted) throw new Error("The image could not be inserted.");
      setImageUploadNotice({ tone: "info", message: "Image uploaded and added." });
    } catch (error) {
      setImageUploadNotice({
        tone: "error",
        message: error instanceof EmailImageUploadError
          ? error.message
          : "The image could not be added. Try again.",
      });
    } finally {
      setImageUploading(false);
    }
  };

  return (
    <div className="email-editor" data-disabled={disabled} aria-busy={imageUploading}>
      <div className="email-toolbar" role="toolbar" aria-label="Email formatting">
        <Tool label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Icon>{ICONS.bold}</Icon></Tool>
        <Tool label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Icon>{ICONS.italic}</Icon></Tool>
        <Tool label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Icon>{ICONS.underline}</Icon></Tool>
        <span className="email-toolbar-divider" aria-hidden="true" />
        <Tool label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Icon>{ICONS.heading}</Icon></Tool>
        <Tool label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><Icon>{ICONS.bulletList}</Icon></Tool>
        <Tool label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><Icon>{ICONS.orderedList}</Icon></Tool>
        <Tool label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Icon>{ICONS.quote}</Icon></Tool>
        <span className="email-toolbar-divider" aria-hidden="true" />
        <Tool label="Link" active={editor.isActive("link")} onClick={addLink}><Icon>{ICONS.link}</Icon></Tool>
        <Tool
          label={imageUploading ? "Uploading image" : "Upload image"}
          disabled={disabled || imageUploading}
          onClick={chooseImage}
        >
          <Icon>{ICONS.image}</Icon>
        </Tool>
        <FormControl.Input
          ref={imageInputRef}
          type="file"
          accept={EMAIL_IMAGE_ACCEPT}
          hidden
          disabled={disabled || imageUploading}
          onChange={addImage}
        />
        <Tool label="Table" onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()}><Icon>{ICONS.table}</Icon></Tool>
        <span className="email-toolbar-divider" aria-hidden="true" />
        <Tool label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><Icon>{ICONS.alignLeft}</Icon></Tool>
        <Tool label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><Icon>{ICONS.alignCenter}</Icon></Tool>
        <label className="email-color-tool" title="Text color">
          <span className="email-color-swatch" style={{ background: (editor.getAttributes("textStyle").color as string | undefined) ?? "currentColor" }} aria-hidden="true" />
          <span className="sr-only">Text color</span>
          <FormControl.Input
            type="color"
            aria-label="Text color"
            value={(editor.getAttributes("textStyle").color as string | undefined) ?? "#10272f"}
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          />
        </label>
        <span className="email-toolbar-divider" aria-hidden="true" />
        <Tool label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Icon>{ICONS.undo}</Icon></Tool>
        <Tool label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Icon>{ICONS.redo}</Icon></Tool>
      </div>
      {imageUploadNotice && (
        <p
          className="email-image-upload-status"
          data-tone={imageUploadNotice.tone}
          role={imageUploadNotice.tone === "error" ? "alert" : "status"}
        >
          {imageUploadNotice.message}
        </p>
      )}
      <EditorContent editor={editor} />
      {mergeFields.length > 0 && (
        <div className="email-merge-fields" aria-label="Insert a recruit field">
          <span>Insert field</span>
          {mergeFields.map((field) => (
            <button
              type="button"
              key={field}
              onClick={() => editor.chain().focus().insertContent(`{{${field}}}`).run()}
            >
              {field.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
