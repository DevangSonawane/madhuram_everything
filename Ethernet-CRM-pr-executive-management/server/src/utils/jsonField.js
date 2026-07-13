export const parseJsonLike = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};

export const jsonTextField = (DataTypes, fieldName, fallbackFactory) => ({
  type: DataTypes.TEXT,
  allowNull: true,
  get() {
    const raw = this.getDataValue(fieldName);
    if (raw == null) return fallbackFactory();
    try {
      return JSON.parse(raw);
    } catch {
      return fallbackFactory();
    }
  },
  set(value) {
    if (value == null || value === '') {
      this.setDataValue(fieldName, null);
      return;
    }
    if (typeof value === 'string') {
      this.setDataValue(fieldName, value);
      return;
    }
    this.setDataValue(fieldName, JSON.stringify(value));
  }
});
