export type CsvRow = Record<string, string>;

export function parseCsv(source: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (quoted) {
      if (character === '"' && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/, ""));
      if (record.some((value) => value.length > 0)) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV inválido: aspas não foram fechadas.");
  if (field.length > 0 || record.length > 0) {
    record.push(field.replace(/\r$/, ""));
    records.push(record);
  }

  const [headers, ...rows] = records;
  if (!headers) return [];

  return rows.map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV inválido na linha ${rowIndex + 2}: esperado ${headers.length} campos, recebido ${values.length}.`,
      );
    }

    return Object.fromEntries(
      headers.map((header, columnIndex) => [header, values[columnIndex]]),
    );
  });
}

export function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

export function required(value: string, label: string): string {
  if (value === "") throw new Error(`Campo obrigatório ausente: ${label}.`);
  return value;
}

export function integerFromCsv(value: string, label: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`Inteiro inválido em ${label}: ${value}`);
  return Number.parseInt(value, 10);
}

export function moneyToCents(value: string, label: string): number {
  if (!/^\d+\.\d{2}$/.test(value)) {
    throw new Error(`Valor monetário inválido em ${label}: ${value}`);
  }
  const [reais, centavos] = value.split(".");
  return Number.parseInt(reais, 10) * 100 + Number.parseInt(centavos, 10);
}

export function brazilianDateToIso(value: string, label: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new Error(`Data inválida em ${label}: ${value}`);
  return `${match[3]}-${match[2]}-${match[1]}`;
}
