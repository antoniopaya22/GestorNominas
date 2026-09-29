import * as React from "react";
import {
  Home,
  Wallet,
  ChartColumn,
  Landmark,
  Tags,
  Receipt,
  ArrowDownToLine,
  FileText,
  Upload,
  Users,
  Settings,
  PieChart,
  ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

type WorkspaceKey = "finanzas" | "nominas";

interface WorkspaceMeta {
  key: WorkspaceKey;
  label: string;
  icon: LucideIcon;
  href: string;
  items: NavItem[];
}

// Única fuente de verdad para la navegación de /app/* — el switcher de
// workspace, los grupos del sidebar y las breadcrumbs se derivan todos de
// aquí a partir de `currentPath`, sin duplicar la lista en ningún otro sitio.
const HOME_ITEM: NavItem = { href: "/app", label: "Inicio", icon: Home };
const SETTINGS_ITEM: NavItem = { href: "/app/settings", label: "Ajustes", icon: Settings };

const WORKSPACES: WorkspaceMeta[] = [
  {
    key: "finanzas",
    label: "Finanzas",
    icon: Wallet,
    href: "/app/finance",
    items: [
      { href: "/app/finance", label: "Dashboard", icon: Wallet, exact: true },
      { href: "/app/finance/analytics", label: "Analítica", icon: PieChart },
      { href: "/app/accounts", label: "Cuentas", icon: Landmark },
      { href: "/app/categories", label: "Categorías", icon: Tags },
      { href: "/app/transactions", label: "Transacciones", icon: Receipt },
      { href: "/app/import", label: "Importar", icon: ArrowDownToLine },
    ],
  },
  {
    key: "nominas",
    label: "Nóminas",
    icon: FileText,
    href: "/app/payroll",
    items: [
      { href: "/app/payroll", label: "Dashboard", icon: ChartColumn },
      { href: "/app/upload", label: "Subir Nóminas", icon: Upload },
      { href: "/app/payslips", label: "Mis Nóminas", icon: FileText },
      { href: "/app/analytics", label: "Analítica", icon: PieChart },
      { href: "/app/profiles", label: "Perfiles", icon: Users },
    ],
  },
];

function normalizePath(path: string): string {
  return path !== "/app" && path.endsWith("/") ? path.slice(0, -1) : path;
}

function isActivePath(currentPath: string, href: string, exact = false): boolean {
  const normalized = normalizePath(currentPath);
  if (href === "/app") return normalized === "/app";
  if (exact) return normalized === href;
  return normalized === href || normalized.startsWith(`${href}/`);
}

// Si la ruta actual no pertenece a ningún workspace (Inicio, Ajustes), se
// muestra Finanzas por defecto — es una elección arbitraria pero
// determinista (misma en servidor y cliente, sin depender de localStorage).
function getActiveWorkspace(currentPath: string): WorkspaceMeta {
  return (
    WORKSPACES.find((ws) => ws.items.some((item) => isActivePath(currentPath, item.href, item.exact))) ??
    WORKSPACES[0]
  );
}

interface Crumb {
  label: string;
  href?: string;
}

function getBreadcrumbTrail(currentPath: string): Crumb[] {
  if (isActivePath(currentPath, HOME_ITEM.href, true)) {
    return [{ label: HOME_ITEM.label }];
  }
  if (isActivePath(currentPath, SETTINGS_ITEM.href)) {
    return [{ label: HOME_ITEM.label, href: HOME_ITEM.href }, { label: SETTINGS_ITEM.label }];
  }
  for (const ws of WORKSPACES) {
    const item = ws.items.find((i) => isActivePath(currentPath, i.href, i.exact));
    if (!item) continue;
    if (item.href === ws.href) {
      return [{ label: HOME_ITEM.label, href: HOME_ITEM.href }, { label: ws.label }];
    }
    return [
      { label: HOME_ITEM.label, href: HOME_ITEM.href },
      { label: ws.label, href: ws.href },
      { label: item.label },
    ];
  }
  return [{ label: HOME_ITEM.label, href: HOME_ITEM.href }];
}

function BrandMark() {
  return (
    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
      <svg
        className="size-4.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    </div>
  );
}

function WorkspaceSwitcher({ active }: { active: WorkspaceMeta }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <BrandMark />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">SueldIA</span>
              <span className="truncate text-xs text-sidebar-foreground/70">{active.label}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--anchor-width) min-w-56 rounded-lg" align="start" side="bottom" sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Espacios de trabajo</DropdownMenuLabel>
              {WORKSPACES.map((ws) => (
                <DropdownMenuItem key={ws.key} render={<a href={ws.href} />} className="gap-2 p-2">
                  <div className="flex size-6 items-center justify-center rounded-md border border-border">
                    <ws.icon className="size-3.5 shrink-0" />
                  </div>
                  {ws.label}
                  {ws.key === active.key && (
                    <span className="ml-auto text-xs text-muted-foreground">Actual</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function NavGroup({ title, items, currentPath }: { title: string; items: NavItem[]; currentPath: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<a href={item.href} />}
                  isActive={isActivePath(currentPath, item.href, item.exact)}
                  tooltip={item.label}
                >
                  <Icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// El sitio se sirve como HTML estático (sin SSR), así que no hay un
// request al que leerle la cookie en el servidor como en el patrón
// habitual de Next.js — sidebar.tsx ya escribe `sidebar_state` al hacer
// toggle (ver SIDEBAR_COOKIE_NAME en ui/sidebar.tsx), así que se lee aquí
// en el propio cliente, una vez, como estado inicial de React.
function readSidebarCookie(): boolean {
  if (typeof document === "undefined") return true;
  const match = document.cookie.match(/(?:^|; )sidebar_state=(true|false)/);
  return match ? match[1] === "true" : true;
}

interface AppShellProps {
  currentPath: string;
  children?: React.ReactNode;
}

export function AppShell({ currentPath, children }: AppShellProps) {
  // El HTML estático siempre se genera con `true` (sin `document` en build
  // no hay cookie que leer) — leerla ya en el useState inicial provocaría un
  // hydration mismatch en visitas donde el cliente sí tiene la cookie a
  // `false`. Se corrige en un efecto, tras el montaje, como una actualización
  // de estado normal (posible micro-flash, pero sin mismatch de hidratación).
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  React.useEffect(() => {
    setSidebarOpen(readSidebarCookie());
  }, []);
  const activeWorkspace = getActiveWorkspace(currentPath);
  const breadcrumbTrail = getBreadcrumbTrail(currentPath);

  return (
    <TooltipProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <WorkspaceSwitcher active={activeWorkspace} />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<a href={HOME_ITEM.href} />}
                      isActive={isActivePath(currentPath, HOME_ITEM.href, true)}
                      tooltip={HOME_ITEM.label}
                    >
                      <Home />
                      <span>{HOME_ITEM.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <NavGroup title={activeWorkspace.label} items={activeWorkspace.items} currentPath={currentPath} />
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<a href={SETTINGS_ITEM.href} />}
                  isActive={isActivePath(currentPath, SETTINGS_ITEM.href)}
                  tooltip={SETTINGS_ITEM.label}
                >
                  <Settings />
                  <span>{SETTINGS_ITEM.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbTrail.map((crumb, i) => (
                  <React.Fragment key={crumb.label}>
                    {i > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.href && i < breadcrumbTrail.length - 1 ? (
                        <BreadcrumbLink render={<a href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
