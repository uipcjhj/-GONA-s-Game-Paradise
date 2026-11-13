export default function Toast({ text }: { text: string | null }) {
  return text ? (
    <div className="p-toast" role="status">
      {text}
    </div>
  ) : null;
}
