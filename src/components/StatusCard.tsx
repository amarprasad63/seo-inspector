interface StatusCardProps {
  title: string;
  detail: string;
}

export function StatusCard({ title, detail }: StatusCardProps) {
  return (
    <div className="state-card" role="status">
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}
