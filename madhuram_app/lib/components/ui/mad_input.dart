import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

/// Input component matching shadcn/ui Input
class MadInput extends StatelessWidget {
  final TextEditingController? controller;
  final String? hintText;
  final String? labelText;
  final String? errorText;
  final bool obscureText;
  final bool enabled;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onEditingComplete;
  final ValueChanged<String>? onSubmitted;
  final Widget? prefix;
  final Widget? suffix;
  final int? maxLines;
  final int? minLines;
  final FocusNode? focusNode;
  final bool autofocus;

  const MadInput({
    super.key,
    this.controller,
    this.hintText,
    this.labelText,
    this.errorText,
    this.obscureText = false,
    this.enabled = true,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onEditingComplete,
    this.onSubmitted,
    this.prefix,
    this.suffix,
    this.maxLines = 1,
    this.minLines,
    this.focusNode,
    this.autofocus = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (labelText != null) ...[
          Text(
            labelText!,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: isDark
                  ? AppTheme.darkForeground
                  : AppTheme.lightForeground,
            ),
          ),
          const SizedBox(height: 8),
        ],
        TextField(
          controller: controller,
          obscureText: obscureText,
          enabled: enabled,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          onChanged: onChanged,
          onEditingComplete: onEditingComplete,
          onSubmitted: onSubmitted,
          maxLines: maxLines,
          minLines: minLines,
          focusNode: focusNode,
          autofocus: autofocus,
          style: TextStyle(
            fontSize: 14,
            color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
          ),
          decoration: InputDecoration(
            hintText: hintText,
            errorText: errorText,
            prefixIcon: prefix,
            suffixIcon: suffix,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 10,
            ),
          ),
        ),
      ],
    );
  }
}

/// Search input with icon
class MadSearchInput extends StatelessWidget {
  final TextEditingController? controller;
  final String? hintText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onClear;
  final double? width;

  const MadSearchInput({
    super.key,
    this.controller,
    this.hintText = 'Search...',
    this.onChanged,
    this.onClear,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    InputDecoration decoration({
      required bool hasText,
      required VoidCallback? onPressedClear,
    }) {
      return InputDecoration(
        hintText: hintText,
        prefixIcon: Icon(
          Icons.search,
          size: 18,
          color: isDark
              ? AppTheme.darkMutedForeground
              : AppTheme.lightMutedForeground,
        ),
        suffixIconConstraints: const BoxConstraints(
          minWidth: 40,
          minHeight: 40,
        ),
        suffixIcon: SizedBox(
          width: 40,
          height: 40,
          child: hasText
              ? IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints.tightFor(
                    width: 40,
                    height: 40,
                  ),
                  onPressed: onPressedClear,
                )
              : const SizedBox.shrink(),
        ),
        contentPadding: const EdgeInsets.symmetric(vertical: 0),
        filled: true,
        fillColor: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted)
            .withValues(alpha: 0.5),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9999),
          borderSide: const BorderSide(width: 1, color: Colors.transparent),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9999),
          borderSide: const BorderSide(width: 1, color: Colors.transparent),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(9999),
          borderSide: BorderSide(
            width: 1,
            color: AppTheme.primaryColor.withValues(alpha: 0.2),
          ),
        ),
      );
    }

    Widget field({required bool hasText}) {
      return TextField(
        controller: controller,
        onChanged: onChanged,
        style: const TextStyle(fontSize: 14),
        decoration: decoration(
          hasText: hasText,
          onPressedClear: controller == null
              ? null
              : () {
                  controller!.clear();
                  onClear?.call();
                },
        ),
      );
    }

    final child = controller == null
        ? field(hasText: false)
        : ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller!,
            builder: (context, value, _) {
              return field(hasText: value.text.isNotEmpty);
            },
          );

    return SizedBox(width: width ?? 320, height: 40, child: child);
  }
}
