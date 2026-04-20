import React, { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (!value) {
        editorRef.current.innerHTML = '';
      }
    }
  }, [value]);

  const execCommand = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    editorRef.current?.focus();
    if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="rich-text-editor" style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-surface)', transition: 'border-color 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', padding: '0.5rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-hover)' }}>
        <button type="button" onClick={() => execCommand('bold')} className="toolbar-btn" title="Bold"><Bold size={16} /></button>
        <button type="button" onClick={() => execCommand('italic')} className="toolbar-btn" title="Italic"><Italic size={16} /></button>
        <button type="button" onClick={() => execCommand('underline')} className="toolbar-btn" title="Underline"><Underline size={16} /></button>
        <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 0.25rem' }} />
        <button type="button" onClick={() => execCommand('formatBlock', 'H1')} className="toolbar-btn" title="Heading 1"><Heading1 size={16} /></button>
        <button type="button" onClick={() => execCommand('formatBlock', 'H2')} className="toolbar-btn" title="Heading 2"><Heading2 size={16} /></button>
        <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 0.25rem' }} />
        <button type="button" onClick={() => execCommand('insertUnorderedList')} className="toolbar-btn" title="Bullet List"><List size={16} /></button>
        <button type="button" onClick={() => execCommand('insertOrderedList')} className="toolbar-btn" title="Numbered List"><ListOrdered size={16} /></button>
        <div style={{ width: '1px', background: 'var(--color-border)', margin: '0 0.25rem' }} />
        <button type="button" onClick={() => execCommand('justifyLeft')} className="toolbar-btn" title="Align Left"><AlignLeft size={16} /></button>
        <button type="button" onClick={() => execCommand('justifyCenter')} className="toolbar-btn" title="Align Center"><AlignCenter size={16} /></button>
        <button type="button" onClick={() => execCommand('justifyRight')} className="toolbar-btn" title="Align Right"><AlignRight size={16} /></button>
      </div>
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        className="editor-content"
        style={{ padding: '1rem', minHeight: '150px', outline: 'none', color: 'var(--color-text)', overflowY: 'auto' }}
        data-placeholder={placeholder}
      />
    </div>
  );
};
