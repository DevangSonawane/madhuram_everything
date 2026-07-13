import React from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActionsMenu({
  items = [],
  align = "end",
  disabled = false,
  triggerLabel = "Open actions",
  triggerClassName,
  contentClassName,
} = {}) {
  const visible = Array.isArray(items) ? items.filter(Boolean) : [];
  const hasItems = visible.some((item) => item.type !== "separator");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("h-8 w-8", triggerClassName)}
          disabled={disabled || !hasItems}
        >
          <span className="sr-only">{triggerLabel}</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn("w-48", contentClassName)}>
        {visible.map((item, index) => {
          if (item.type === "separator") {
            return <DropdownMenuSeparator key={`sep-${index}`} />;
          }

          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.key || `${item.label}-${index}`}
              className={cn(
                item.destructive ? "text-destructive focus:text-destructive" : null,
                item.className,
              )}
              disabled={Boolean(item.disabled)}
              onClick={() => {
                if (item.disabled) return;
                item.onSelect?.();
              }}
            >
              {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

