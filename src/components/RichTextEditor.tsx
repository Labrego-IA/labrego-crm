import { useRef, useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  className?: string
}

export default function RichTextEditor({ value, onChange, className = '' }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value
    }
  }, [value])

  const exec = (command: string, arg?: string) => {
    document.execCommand(command, false, arg)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const handleInput = () => {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  return (
    <div className={`border rounded ${className}`}>
      <div className="flex items-center space-x-2 border-b p-1">
        <button type="button" onClick={() => exec('bold')} className="px-2 font-bold">
          B
        </button>
        <input type="color" onChange={e => exec('foreColor', e.target.value)} />
      </div>
      <div
        ref={ref}
        className="p-2 min-h-[6rem] outline-none whitespace-pre-wrap"
        contentEditable
        onInput={handleInput}
      />
    </div>
  )
}
