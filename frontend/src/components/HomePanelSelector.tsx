export interface HomePanelSelectorProps {
  panels: Array<{ key: string; name: string }>;
  value: string;
  onChange: (panel: string) => void;
}

export default function HomePanelSelector({ panels, value, onChange }: HomePanelSelectorProps) {
  return (
    <div className="flex items-center space-x-2">
      <label className="text-sm text-gray-600">Panel</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border rounded-md text-sm"
      >
        {panels.map((p) => (
          <option key={p.key} value={p.key}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
