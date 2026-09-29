import { FolderPlus, Tag } from "lucide-react";
import type { CategoryGroup } from "../../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NONE } from "./shared";

interface Props {
  open: boolean;
  onClose: () => void;
  groups: CategoryGroup[];
  newGroupName: string;
  setNewGroupName: (v: string) => void;
  newCategoryGroupId: number | "";
  setNewCategoryGroupId: (v: number | "") => void;
  newCategoryName: string;
  setNewCategoryName: (v: string) => void;
  onCreateGroup: (e: React.FormEvent) => void;
  onCreateCategory: (e: React.FormEvent) => void;
  creatingGroup: boolean;
  creatingCategory: boolean;
}

// Alta rápida sin salir de Transacciones: la categoría nueva queda
// seleccionada en el formulario abierto.
export function QuickCategoryDialog({
  open, onClose, groups,
  newGroupName, setNewGroupName, newCategoryGroupId, setNewCategoryGroupId, newCategoryName, setNewCategoryName,
  onCreateGroup, onCreateCategory, creatingGroup, creatingCategory,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 pt-5 pb-4">
          <DialogTitle>Nueva categoría</DialogTitle>
          <DialogDescription>
            Queda disponible al instante en el formulario, sin perder lo que ya has escrito. Para ordenarlas a fondo, ve a{" "}
            <a href="/app/categories" className="font-medium text-foreground underline underline-offset-4">Categorías</a>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onCreateCategory} className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Tag className="size-4 text-muted-foreground" /> Categoría
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-cat-group">Grupo</Label>
            <Select
              value={newCategoryGroupId ? String(newCategoryGroupId) : NONE}
              onValueChange={(v) => setNewCategoryGroupId(!v || v === NONE ? "" : Number(v))}
            >
              <SelectTrigger id="quick-cat-group" className="w-full">
                <SelectValue placeholder="Selecciona grupo">
                  {(v: string) => groups.find((g) => String(g.id) === v)?.name ?? <span className="text-muted-foreground">Selecciona grupo</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Selecciona grupo</SelectItem>
                {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-cat-name">Nombre</Label>
            <div className="flex gap-2">
              <Input id="quick-cat-name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Ej: Supermercado" />
              <Button type="submit" disabled={creatingCategory || groups.length === 0}>
                {creatingCategory ? "Creando…" : "Crear"}
              </Button>
            </div>
            {groups.length === 0 && <p className="text-xs text-muted-foreground">Primero crea un grupo.</p>}
          </div>
        </form>

        <form onSubmit={onCreateGroup} className="space-y-3 rounded-b-xl border-t border-border bg-muted/30 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FolderPlus className="size-4 text-muted-foreground" /> ¿Falta el grupo?
          </div>
          <div className="flex gap-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Ej: Hogar"
              aria-label="Nombre del grupo nuevo"
              className="bg-card"
            />
            <Button type="submit" variant="outline" disabled={creatingGroup}>
              {creatingGroup ? "Creando…" : "Crear grupo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
