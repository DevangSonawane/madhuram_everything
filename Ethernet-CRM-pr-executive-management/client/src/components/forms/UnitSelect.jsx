import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const UNIT_OPTIONS = [
  { value: "MG", label: "Mg" },
  { value: "G", label: "G" },
  { value: "NOS", label: "Nos" },
  { value: "PCS", label: "Pcs" },
  { value: "KG", label: "Kg" },
  { value: "TON", label: "Ton" },
  { value: "MM", label: "Mm" },
  { value: "CM", label: "Cm" },
  { value: "M", label: "Meter" },
  { value: "FT", label: "Feet" },
  { value: "SQMM", label: "Sq Mm" },
  { value: "SQCM", label: "Sq Cm" },
  { value: "SQFT", label: "Sq Ft" },
  { value: "SQM", label: "Sq M" },
  { value: "ML", label: "Ml" },
  { value: "BOX", label: "Box" },
  { value: "BUNDLE", label: "Bundle" },
  { value: "SET", label: "Set" },
  { value: "ROLL", label: "Roll" },
  { value: "LTR", label: "Litre" },
];

export const AREA_UNITS = ["SQMM", "SQCM", "SQFT", "SQM"];

const UNIT_FACTORS = {
  MG: { group: "mass", factor: 0.001 }, // grams
  G: { group: "mass", factor: 1 },
  KG: { group: "mass", factor: 1000 },
  TON: { group: "mass", factor: 1_000_000 },
  MM: { group: "length", factor: 0.001 }, // meters
  CM: { group: "length", factor: 0.01 },
  M: { group: "length", factor: 1 },
  FT: { group: "length", factor: 0.3048 },
  SQMM: { group: "area", factor: 0.000001 }, // sq meters
  SQCM: { group: "area", factor: 0.0001 },
  SQM: { group: "area", factor: 1 },
  SQFT: { group: "area", factor: 0.092903 },
  ML: { group: "volume", factor: 0.001 }, // liters
  LTR: { group: "volume", factor: 1 },
};

const UNIT_VALUE_SET = new Set(UNIT_OPTIONS.map((option) => option.value));
const UNIT_NORMALIZATION_MAP = {
  nos: "NOS",
  no: "NOS",
  pcs: "PCS",
  pc: "PCS",
  mg: "MG",
  g: "G",
  kg: "KG",
  kgs: "KG",
  kilogram: "KG",
  kilograms: "KG",
  ton: "TON",
  tons: "TON",
  tonne: "TON",
  tonnes: "TON",
  mm: "MM",
  cm: "CM",
  m: "M",
  meter: "M",
  metres: "M",
  metre: "M",
  mtr: "M",
  ft: "FT",
  feet: "FT",
  sqmm: "SQMM",
  sqcm: "SQCM",
  sqft: "SQFT",
  sqfeet: "SQFT",
  sqfoot: "SQFT",
  sqm: "SQM",
  sqmeter: "SQM",
  sqmetre: "SQM",
  ml: "ML",
  box: "BOX",
  boxes: "BOX",
  bundle: "BUNDLE",
  bundles: "BUNDLE",
  set: "SET",
  sets: "SET",
  roll: "ROLL",
  rolls: "ROLL",
  ltr: "LTR",
  litre: "LTR",
  litres: "LTR",
  liter: "LTR",
  liters: "LTR",
};

const normalizeUnitValue = (value) => {
  if (!value) return "";
  if (UNIT_VALUE_SET.has(value)) return value;
  const cleaned = String(value).trim().toLowerCase();
  const compact = cleaned.replace(/[^a-z0-9]/g, "");
  return UNIT_NORMALIZATION_MAP[compact] || "";
};

const roundValue = (value) => {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Number.isFinite(rounded) ? rounded : value;
};

const toNumber = (value) => {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const convertQuantity = (value, fromUnit, toUnit) => {
  const amount = toNumber(value);
  if (amount == null) return null;
  const fromKey = normalizeUnitValue(fromUnit);
  const toKey = normalizeUnitValue(toUnit);
  if (!fromKey || !toKey || fromKey === toKey) return String(amount);
  const from = UNIT_FACTORS[fromKey];
  const to = UNIT_FACTORS[toKey];
  if (!from || !to || from.group !== to.group) return null;
  const converted = roundValue((amount * from.factor) / to.factor);
  return String(converted);
};

export const convertPricePerUnit = (value, fromUnit, toUnit) => {
  const amount = toNumber(value);
  if (amount == null) return null;
  const fromKey = normalizeUnitValue(fromUnit);
  const toKey = normalizeUnitValue(toUnit);
  if (!fromKey || !toKey || fromKey === toKey) return String(amount);
  const from = UNIT_FACTORS[fromKey];
  const to = UNIT_FACTORS[toKey];
  if (!from || !to || from.group !== to.group) return null;
  const converted = roundValue((amount * to.factor) / from.factor);
  return String(converted);
};

export function UnitSelect({
  value,
  onValueChange,
  placeholder = "Select unit",
  triggerClassName,
  disabled = false,
}) {
  const normalizedValue = normalizeUnitValue(value);
  return (
    <Select value={normalizedValue} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {UNIT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
