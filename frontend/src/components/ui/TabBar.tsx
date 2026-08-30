interface Tab<T extends string> {
  key: T;
  label: string;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (key: T) => void;
}

export function TabBar<T extends string>({ tabs, active, onChange }: TabBarProps<T>) {
  return (
    <div role="tablist" className="inline-flex rounded-xl bg-surface-100 p-1 gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            active === tab.key ? "bg-white text-surface-900 shadow-sm" : "text-surface-500 hover:text-surface-800"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
