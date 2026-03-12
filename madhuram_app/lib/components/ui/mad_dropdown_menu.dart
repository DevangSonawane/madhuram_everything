import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

/// Menu item for dropdown
class MadMenuItem {
  final String label;
  final IconData? icon;
  final VoidCallback? onTap;
  final bool destructive;
  final bool disabled;
  final bool dividerAfter;

  const MadMenuItem({
    required this.label,
    this.icon,
    this.onTap,
    this.destructive = false,
    this.disabled = false,
    this.dividerAfter = false,
  });
}

/// Dropdown menu component matching shadcn/ui DropdownMenu
class MadDropdownMenu extends StatelessWidget {
  final Widget trigger;
  final List<MadMenuItem> items;
  final double? menuWidth;
  final Offset offset;

  const MadDropdownMenu({
    super.key,
    required this.trigger,
    required this.items,
    this.menuWidth,
    this.offset = const Offset(0, 4),
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<int>(
      offset: offset,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: Theme.of(context).brightness == Brightness.dark
              ? AppTheme.darkBorder
              : AppTheme.lightBorder,
        ),
      ),
      color: Theme.of(context).brightness == Brightness.dark
          ? AppTheme.darkCard
          : Colors.white,
      elevation: 8,
      itemBuilder: (context) {
        final List<PopupMenuEntry<int>> menuItems = [];
        for (int i = 0; i < items.length; i++) {
          final item = items[i];
          menuItems.add(
            PopupMenuItem<int>(
              value: i,
              enabled: !item.disabled,
              onTap: item.onTap == null ? null : () => Future.microtask(item.onTap!),
              child: _MenuItemContent(item: item),
            ),
          );
          if (item.dividerAfter && i < items.length - 1) {
            menuItems.add(const PopupMenuDivider(height: 8));
          }
        }
        return menuItems;
      },
      constraints: menuWidth != null
          ? BoxConstraints(minWidth: menuWidth!, maxWidth: menuWidth!)
          : null,
      child: trigger,
    );
  }
}

class _MenuItemContent extends StatelessWidget {
  final MadMenuItem item;

  const _MenuItemContent({required this.item});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = item.disabled
        ? (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground)
        : item.destructive
            ? AppTheme.lightDestructive
            : (isDark ? AppTheme.darkForeground : AppTheme.lightForeground);

    return Row(
      children: [
        if (item.icon != null) ...[
          Icon(
            item.icon,
            size: 16,
            color: textColor,
          ),
          const SizedBox(width: 8),
        ],
        Expanded(
          child: Text(
            item.label,
            style: TextStyle(
              fontSize: 14,
              color: textColor,
            ),
          ),
        ),
      ],
    );
  }
}

/// Icon button with dropdown menu
class MadDropdownMenuButton extends StatelessWidget {
  final List<MadMenuItem> items;
  final IconData icon;
  final double? menuWidth;
  final String? tooltip;

  const MadDropdownMenuButton({
    super.key,
    required this.items,
    this.icon = Icons.more_vert,
    this.menuWidth,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return MadDropdownMenu(
      items: items,
      menuWidth: menuWidth,
      trigger: Tooltip(
        message: tooltip ?? 'More options',
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
          ),
          child: Icon(
            icon,
            size: 18,
            color: Theme.of(context).brightness == Brightness.dark
                ? AppTheme.darkMutedForeground
                : AppTheme.lightMutedForeground,
          ),
        ),
      ),
    );
  }
}

/// Context menu wrapper
class MadContextMenu extends StatelessWidget {
  final Widget child;
  final List<MadMenuItem> items;

  const MadContextMenu({
    super.key,
    required this.child,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onSecondaryTapDown: (details) {
        _showContextMenu(context, details.globalPosition);
      },
      onLongPressStart: (details) {
        _showContextMenu(context, details.globalPosition);
      },
      child: child,
    );
  }

  void _showContextMenu(BuildContext context, Offset position) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showMenu(
      context: context,
      position: RelativeRect.fromLTRB(
        position.dx,
        position.dy,
        position.dx,
        position.dy,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
      ),
      color: isDark ? AppTheme.darkCard : Colors.white,
      items: items.map((item) {
        return PopupMenuItem(
          onTap: item.onTap,
          enabled: !item.disabled,
          child: _MenuItemContent(item: item),
        );
      }).toList(),
    );
  }
}
