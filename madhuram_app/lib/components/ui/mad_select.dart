import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

/// Option for select dropdown
class MadSelectOption<T> {
  final T value;
  final String label;
  final IconData? icon;
  final bool disabled;

  const MadSelectOption({
    required this.value,
    required this.label,
    this.icon,
    this.disabled = false,
  });
}

/// Select component matching shadcn/ui Select
class MadSelect<T> extends StatefulWidget {
  final T? value;
  final List<MadSelectOption<T>> options;
  final ValueChanged<T?>? onChanged;
  final String? placeholder;
  final String? labelText;
  final String? errorText;
  final bool disabled;
  final bool clearable;
  final double? width;
  final bool searchable;
  final String? searchHint;

  const MadSelect({
    super.key,
    this.value,
    required this.options,
    this.onChanged,
    this.placeholder,
    this.labelText,
    this.errorText,
    this.disabled = false,
    this.clearable = false,
    this.width,
    this.searchable = false,
    this.searchHint,
  });

  @override
  State<MadSelect<T>> createState() => _MadSelectState<T>();
}

class _MadSelectState<T> extends State<MadSelect<T>> {
  final LayerLink _layerLink = LayerLink();
  OverlayEntry? _overlayEntry;
  bool _isOpen = false;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _removeOverlay();
    _searchController.dispose();
    super.dispose();
  }

  void _removeOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
    _isOpen = false;
    _searchQuery = '';
    _searchController.clear();
  }

  void _toggleDropdown() {
    if (widget.disabled) return;
    if (!mounted) return;

    if (_isOpen) {
      _removeOverlay();
      if (mounted) setState(() {});
    } else {
      _showOverlay();
    }
  }

  void _showOverlay() {
    if (!mounted) return;
    _overlayEntry = _createOverlayEntry();
    Overlay.of(context).insert(_overlayEntry!);
    if (mounted) setState(() => _isOpen = true);
  }

  OverlayEntry _createOverlayEntry() {
    final RenderBox renderBox = context.findRenderObject() as RenderBox;
    final size = renderBox.size;

    return OverlayEntry(
      builder: (context) => Stack(
        children: [
          // Backdrop to close on tap outside
          Positioned.fill(
            child: GestureDetector(
              onTap: () {
                _removeOverlay();
                if (mounted) setState(() {});
              },
              behavior: HitTestBehavior.opaque,
              child: Container(color: Colors.transparent),
            ),
          ),
          // Dropdown
          Positioned(
            width: widget.width ?? size.width,
            child: CompositedTransformFollower(
              link: _layerLink,
              offset: Offset(0, size.height + 4),
              showWhenUnlinked: false,
              child: Material(
                color: Colors.transparent,
                child: _SelectDropdown<T>(
                  options: widget.options,
                  selectedValue: widget.value,
                  searchable: widget.searchable,
                  searchHint: widget.searchHint,
                  searchController: _searchController,
                  searchQuery: _searchQuery,
                  onSearchChanged: (query) {
                    if (!mounted) return;
                    setState(() => _searchQuery = query);
                    _overlayEntry?.markNeedsBuild();
                  },
                  onSelect: (value) {
                    widget.onChanged?.call(value);
                    _removeOverlay();
                    if (mounted) setState(() {});
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final selectedOption = widget.options.where((o) => o.value == widget.value).firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.labelText != null) ...[
          Text(
            widget.labelText!,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
            ),
          ),
          const SizedBox(height: 8),
        ],
        CompositedTransformTarget(
          link: _layerLink,
          child: GestureDetector(
            onTap: _toggleDropdown,
            child: Container(
              width: widget.width,
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: (isDark ? AppTheme.darkMuted : AppTheme.lightMuted).withOpacity(0.5),
                borderRadius: BorderRadius.circular(8),
                border: widget.errorText != null
                    ? Border.all(color: AppTheme.lightDestructive)
                    : _isOpen
                        ? Border.all(color: AppTheme.primaryColor.withOpacity(0.5))
                        : null,
              ),
              child: Row(
                children: [
                  if (selectedOption?.icon != null) ...[
                    Icon(
                      selectedOption!.icon,
                      size: 16,
                      color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(
                      selectedOption?.label ?? widget.placeholder ?? 'Select...',
                      style: TextStyle(
                        fontSize: 14,
                        color: selectedOption != null
                            ? (isDark ? AppTheme.darkForeground : AppTheme.lightForeground)
                            : (isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground),
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (widget.clearable && widget.value != null)
                    GestureDetector(
                      onTap: () {
                        widget.onChanged?.call(null);
                      },
                      child: Padding(
                        padding: const EdgeInsets.only(right: 4),
                        child: Icon(
                          Icons.close,
                          size: 16,
                          color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                        ),
                      ),
                    ),
                  Icon(
                    _isOpen ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    size: 20,
                    color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                  ),
                ],
              ),
            ),
          ),
        ),
        if (widget.errorText != null) ...[
          const SizedBox(height: 4),
          Text(
            widget.errorText!,
            style: const TextStyle(
              fontSize: 12,
              color: AppTheme.lightDestructive,
            ),
          ),
        ],
      ],
    );
  }
}

class _SelectDropdown<T> extends StatelessWidget {
  final List<MadSelectOption<T>> options;
  final T? selectedValue;
  final bool searchable;
  final String? searchHint;
  final TextEditingController searchController;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<T> onSelect;

  const _SelectDropdown({
    required this.options,
    this.selectedValue,
    required this.searchable,
    this.searchHint,
    required this.searchController,
    required this.searchQuery,
    required this.onSearchChanged,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final filteredOptions = searchQuery.isEmpty
        ? options
        : options.where((o) => o.label.toLowerCase().contains(searchQuery.toLowerCase())).toList();

    return Container(
      constraints: const BoxConstraints(maxHeight: 300),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.darkCard : Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (searchable) ...[
            Padding(
              padding: const EdgeInsets.all(8),
              child: TextField(
                controller: searchController,
                onChanged: onSearchChanged,
                autofocus: true,
                style: const TextStyle(fontSize: 14),
                decoration: InputDecoration(
                  hintText: searchHint ?? 'Search...',
                  prefixIcon: const Icon(Icons.search, size: 18),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 8),
                ),
              ),
            ),
            Divider(
              height: 1,
              color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
            ),
          ],
          Flexible(
            child: filteredOptions.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'No options found',
                      style: TextStyle(
                        color: isDark ? AppTheme.darkMutedForeground : AppTheme.lightMutedForeground,
                      ),
                    ),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    itemCount: filteredOptions.length,
                    itemBuilder: (context, index) {
                      final option = filteredOptions[index];
                      final isSelected = option.value == selectedValue;

                      return InkWell(
                        onTap: option.disabled ? null : () => onSelect(option.value),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          color: isSelected
                              ? AppTheme.primaryColor.withOpacity(0.1)
                              : Colors.transparent,
                          child: Row(
                            children: [
                              if (option.icon != null) ...[
                                Icon(
                                  option.icon,
                                  size: 16,
                                  color: option.disabled
                                      ? (isDark
                                          ? AppTheme.darkMutedForeground
                                          : AppTheme.lightMutedForeground)
                                      : (isDark ? AppTheme.darkForeground : AppTheme.lightForeground),
                                ),
                                const SizedBox(width: 8),
                              ],
                              Expanded(
                                child: Text(
                                  option.label,
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: option.disabled
                                        ? (isDark
                                            ? AppTheme.darkMutedForeground
                                            : AppTheme.lightMutedForeground)
                                        : (isDark
                                            ? AppTheme.darkForeground
                                            : AppTheme.lightForeground),
                                  ),
                                ),
                              ),
                              if (isSelected)
                                Icon(
                                  Icons.check,
                                  size: 16,
                                  color: AppTheme.primaryColor,
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

/// Multi-select component
class MadMultiSelect<T> extends StatelessWidget {
  final Set<T> values;
  final List<MadSelectOption<T>> options;
  final ValueChanged<Set<T>>? onChanged;
  final String? placeholder;
  final String? labelText;
  final bool disabled;
  final double? width;

  const MadMultiSelect({
    super.key,
    required this.values,
    required this.options,
    this.onChanged,
    this.placeholder,
    this.labelText,
    this.disabled = false,
    this.width,
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
              color: isDark ? AppTheme.darkForeground : AppTheme.lightForeground,
            ),
          ),
          const SizedBox(height: 8),
        ],
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: options.map((option) {
            final isSelected = values.contains(option.value);
            return FilterChip(
              label: Text(option.label),
              selected: isSelected,
              onSelected: disabled || option.disabled
                  ? null
                  : (selected) {
                      final newValues = Set<T>.from(values);
                      if (selected) {
                        newValues.add(option.value);
                      } else {
                        newValues.remove(option.value);
                      }
                      onChanged?.call(newValues);
                    },
            );
          }).toList(),
        ),
      ],
    );
  }
}
