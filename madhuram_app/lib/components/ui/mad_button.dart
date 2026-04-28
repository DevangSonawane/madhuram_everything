import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

enum ButtonVariant { primary, secondary, outline, ghost, destructive, link }

enum ButtonSize { sm, md, lg, icon }

/// Button component matching shadcn/ui Button
class MadButton extends StatelessWidget {
  final String? text;
  final Widget? child;
  final VoidCallback? onPressed;
  final ButtonVariant variant;
  final ButtonSize size;
  final bool loading;
  final bool disabled;
  final IconData? icon;
  final IconData? trailingIcon;
  final double? width;

  const MadButton({
    super.key,
    this.text,
    this.child,
    this.onPressed,
    this.variant = ButtonVariant.primary,
    this.size = ButtonSize.md,
    this.loading = false,
    this.disabled = false,
    this.icon,
    this.trailingIcon,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    // Get colors based on variant
    Color backgroundColor;
    Color foregroundColor;
    Color? borderColor;

    switch (variant) {
      case ButtonVariant.primary:
        backgroundColor = AppTheme.primaryColor;
        foregroundColor = Colors.white;
        break;
      case ButtonVariant.secondary:
        backgroundColor = isDark ? AppTheme.darkMuted : AppTheme.lightMuted;
        foregroundColor = isDark
            ? AppTheme.darkForeground
            : AppTheme.lightForeground;
        break;
      case ButtonVariant.outline:
        backgroundColor = Colors.transparent;
        foregroundColor = isDark
            ? AppTheme.darkForeground
            : AppTheme.lightForeground;
        borderColor = isDark ? AppTheme.darkBorder : AppTheme.lightBorder;
        break;
      case ButtonVariant.ghost:
        backgroundColor = Colors.transparent;
        foregroundColor = isDark
            ? AppTheme.darkForeground
            : AppTheme.lightForeground;
        break;
      case ButtonVariant.destructive:
        backgroundColor = const Color(0xFFEF4444);
        foregroundColor = Colors.white;
        break;
      case ButtonVariant.link:
        backgroundColor = Colors.transparent;
        foregroundColor = AppTheme.primaryColor;
        break;
    }

    // Get padding based on size
    EdgeInsetsGeometry padding;
    double fontSize;
    double iconSize;
    double height;

    switch (size) {
      case ButtonSize.sm:
        padding = const EdgeInsets.symmetric(horizontal: 12, vertical: 8);
        fontSize = 13;
        iconSize = 16;
        height = 36;
        break;
      case ButtonSize.md:
        padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 10);
        fontSize = 14;
        iconSize = 18;
        height = 40;
        break;
      case ButtonSize.lg:
        padding = const EdgeInsets.symmetric(horizontal: 24, vertical: 12);
        fontSize = 16;
        iconSize = 20;
        height = 48;
        break;
      case ButtonSize.icon:
        padding = const EdgeInsets.all(10);
        fontSize = 14;
        iconSize = 18;
        height = 40;
        break;
    }

    final isDisabled = disabled || loading;

    final hasLabel = (text != null && text!.isNotEmpty) || child != null;

    Widget buttonContent = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading)
          Padding(
            padding: EdgeInsets.only(right: hasLabel ? 8 : 0),
            child: SizedBox(
              width: iconSize,
              height: iconSize,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(foregroundColor),
              ),
            ),
          )
        else if (icon != null)
          Padding(
            padding: EdgeInsets.only(right: text != null ? 8 : 0),
            child: Icon(icon, size: iconSize),
          ),
        if (child != null)
          child!
        else if (text != null)
          Text(
            text!,
            style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w500),
          ),
        if (trailingIcon != null)
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Icon(trailingIcon, size: iconSize),
          ),
      ],
    );

    return SizedBox(
      width: width ?? (size == ButtonSize.icon ? height : null),
      height: height,
      child: Material(
        color: isDisabled ? backgroundColor.withOpacity(0.5) : backgroundColor,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: isDisabled ? null : onPressed,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: padding,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: borderColor != null
                  ? Border.all(
                      color: isDisabled
                          ? borderColor.withOpacity(0.5)
                          : borderColor,
                    )
                  : null,
            ),
            child: DefaultTextStyle(
              style: TextStyle(
                color: isDisabled
                    ? foregroundColor.withOpacity(0.5)
                    : foregroundColor,
                fontWeight: FontWeight.w500,
              ),
              child: IconTheme(
                data: IconThemeData(
                  color: isDisabled
                      ? foregroundColor.withOpacity(0.5)
                      : foregroundColor,
                ),
                child: Center(child: buttonContent),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
