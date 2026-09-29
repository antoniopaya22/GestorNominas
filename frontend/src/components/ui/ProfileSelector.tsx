import { Button } from "@/components/ui/button";
import { cn } from "cn";

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
    <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Seleccionar perfil">
      {profiles.map((p) => {
        const isSelected = selected.includes(p.id);
        return (
          <Button
            key={p.id}
            type="button"
            variant={isSelected ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleClick(p.id)}
            aria-pressed={isSelected}
            className={cn("gap-1.5", isSelected ? "shadow-sm" : "text-muted-foreground")}
          >
            <div
              className={cn("w-2.5 h-2.5 rounded-full transition-opacity", isSelected ? "opacity-100" : "opacity-40")}
              style={{ backgroundColor: p.color }}
            />
            {p.name}
          </Button>
        );
      })}
    </div>
  );
}
