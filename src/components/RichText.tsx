/**
 * Renderizado seguro de texto con formato mínimo (sin HTML):
 *  "## Título", "### Subtítulo", "- elemento de lista", párrafos separados por línea en blanco.
 * React escapa todo el contenido, por lo que no hay riesgo de inyección.
 */
export function RichText({ text, className = "prose-jnd" }: { text: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{para.join(" ")}</p>);
    if (list.length)
      blocks.push(
        <ul key={blocks.length}>
          {list.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>,
      );
    para = [];
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) flush();
    else if (line.startsWith("### ")) (flush(), blocks.push(<h3 key={blocks.length}>{line.slice(4)}</h3>));
    else if (line.startsWith("## ")) (flush(), blocks.push(<h2 key={blocks.length}>{line.slice(3)}</h2>));
    else if (/^[-•*] /.test(line)) {
      if (para.length) { const p = para; para = []; blocks.push(<p key={blocks.length}>{p.join(" ")}</p>); }
      list.push(line.slice(2));
    } else {
      if (list.length) flush();
      para.push(line);
    }
  }
  flush();
  return <div className={className}>{blocks}</div>;
}
