interface Profile {
  id: number;
  name: string;
  color: string;
}

interface ProfileSelectorProps {
  profiles: Profile[];
  value: number | number[];
  onChange: (value: number | number[]) => void;
  multi?: boolean;
}

export function ProfileSelector({ profiles, value, onChange, multi = false }: ProfileSelectorProps) {
  if (profiles.length <= 1 && !multi) return null;

  const selected = Array.isArray(value) ? value : [value];

  function handleClick(id: number) {
    if (multi) {
      const next = selected.includes(id)
        ? selected.filter((v) => v !== id)
        : [...selected, id];
      onChange(next);
    } else {
      onChange(id);
    }
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {profiles.map((p) => {
        const isSelected = selected.includes(p.id);
        return (
          <button
            key={p.id}
            onClick={() => handleClick(p.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
              isSelected
                ? "bg-white shadow-card border border-surface-200 text-surface-900"
                : "text-surface-400 hover:text-surface-600 hover:bg-surface-100"
            }`}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full transition-opacity ${isSelected ? "opacity-100" : "opacity-40"}`}
              style={{ backgroundColor: p.color }}
            />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
