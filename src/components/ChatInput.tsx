import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Paperclip, Image, AtSign, Command } from 'lucide-react';

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-area">
      <div className="input-container">
        <div className="input-top">
          <textarea
            ref={textareaRef}
            className="input-textarea"
            placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
          />
          <button className="input-send" onClick={handleSend} disabled={!value.trim() || disabled}>
            <Send size={16} />
          </button>
        </div>
        <div className="input-bottom">
          <div className="input-attachments">
            <button className="input-attachment-btn" title="Attach file">
              <Paperclip size={14} />
            </button>
            <button className="input-attachment-btn" title="Attach image">
              <Image size={14} />
            </button>
            <button className="input-attachment-btn" title="Mention skill">
              <AtSign size={14} />
            </button>
            <button className="input-attachment-btn" title="Run command">
              <Command size={14} />
            </button>
          </div>
          <div className="input-hint">
            {value.length > 0 ? `${value.length} chars` : 'Shift+Enter for new line'}
          </div>
        </div>
      </div>
    </div>
  );
}
